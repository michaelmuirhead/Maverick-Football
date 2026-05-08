import { RNG } from "@/lib/rng";
import type {
  BoxStat, DriveLog, Game, GameResult, League, Player, Team, Weather,
} from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { teamSimRatings } from "@/lib/gen/roster";
import { personalityFor } from "@/lib/cpu/personalities";
import { offensiveMods, defensiveMods, ensureGamePlan, type CoachingMods } from "@/lib/cpu/gamePlan";
import { rollWeather, weatherModifiers, hfaBoost } from "@/lib/cpu/weather";
import { chemistryActiveBonus } from "@/lib/cpu/chemistry";
import { clamp } from "@/lib/utils";

// =====================================================================
// Drive-based football simulation. Aim: realistic NFL averages per game.
// Targets per team: ~22 pts, ~340 yds, ~63 plays, ~11 drives, ~1.3 TO.
// =====================================================================

interface SimContext {
  league: League;
  rng: RNG;
  homeTeamId: string;
  awayTeamId: string;
  homeRatings: ReturnType<typeof teamSimRatings>;
  awayRatings: ReturnType<typeof teamSimRatings>;
  homeBox: Map<string, BoxStat>;
  awayBox: Map<string, BoxStat>;
  homeYards: number;
  awayYards: number;
  homeTOP: number;
  awayTOP: number;
  homeTO: number;
  awayTO: number;
  homeScore: number;
  awayScore: number;
  homeOffMods: CoachingMods;
  homeDefMods: CoachingMods;
  awayOffMods: CoachingMods;
  awayDefMods: CoachingMods;
  weather?: Weather;
  weatherMods: ReturnType<typeof weatherModifiers>;
  homeHfa: number;
}

export function simulateGame(league: League, game: Game, rngSeed: string): GameResult {
  const rng = new RNG(`${rngSeed}:${game.id}`);
  const homeT = TEAMS_BY_ID[game.home];
  const awayT = TEAMS_BY_ID[game.away];

  // Ensure both teams have a game plan; CPU teams auto-generate
  ensureGamePlan(league, game.id, homeT.id, awayT.id);
  ensureGamePlan(league, game.id, awayT.id, homeT.id);

  const weather = rollWeather(league, game);
  const weatherMods = weatherModifiers(weather);
  const homeHfa = hfaBoost(homeT);

  const ctx: SimContext = {
    league,
    rng,
    homeTeamId: homeT.id,
    awayTeamId: awayT.id,
    homeRatings: teamSimRatings(league, homeT.id),
    awayRatings: teamSimRatings(league, awayT.id),
    homeBox: new Map(),
    awayBox: new Map(),
    homeYards: 0,
    awayYards: 0,
    homeTOP: 0,
    awayTOP: 0,
    homeTO: 0,
    awayTO: 0,
    homeScore: 0,
    awayScore: 0,
    homeOffMods: offensiveMods(league, homeT.id, game.id),
    homeDefMods: defensiveMods(league, homeT.id, game.id),
    awayOffMods: offensiveMods(league, awayT.id, game.id),
    awayDefMods: defensiveMods(league, awayT.id, game.id),
    weather,
    weatherMods,
    homeHfa,
  };

  const drives: DriveLog[] = [];

  // ~12 drives per team (24 total) over 60 min = 3600 sec
  // Time-based loop instead of fixed count to allow blowouts to feel different
  let timeRemaining = 3600;
  let possessor: "home" | "away" = rng.chance(0.5) ? "home" : "away";

  while (timeRemaining > 0) {
    const isHome = possessor === "home";
    const offRatings = isHome ? ctx.homeRatings : ctx.awayRatings;
    const defRatings = isHome ? ctx.awayRatings : ctx.homeRatings;
    const offTeam = isHome ? homeT : awayT;
    const defTeam = isHome ? awayT : homeT;

    const drive = simulateDrive(ctx, offTeam, defTeam, offRatings, defRatings, timeRemaining);
    drives.push(drive);

    timeRemaining -= drive.timeSec;

    if (isHome) {
      ctx.homeYards += drive.yards;
      ctx.homeTOP += drive.timeSec;
    } else {
      ctx.awayYards += drive.yards;
      ctx.awayTOP += drive.timeSec;
    }

    // Apply scoring
    if (drive.result === "TD") {
      if (isHome) ctx.homeScore += 7; else ctx.awayScore += 7;
    } else if (drive.result === "FG") {
      if (isHome) ctx.homeScore += 3; else ctx.awayScore += 3;
    }

    // Turnovers
    if (drive.result === "INT" || drive.result === "FUM") {
      if (isHome) ctx.homeTO++; else ctx.awayTO++;
    }

    // Possession flip (next drive other team) unless EOH/EOG
    if (drive.result !== "EOH" && drive.result !== "EOG") {
      possessor = possessor === "home" ? "away" : "home";
    }
  }

  // Overtime if tied
  let ot = false;
  if (ctx.homeScore === ctx.awayScore) {
    ot = true;
    const otRng = new RNG(`${rngSeed}:${game.id}:ot`);
    const otCtx = { ...ctx, rng: otRng };
    let otTime = 600; // 10 min
    let otPossessor: "home" | "away" = rng.chance(0.5) ? "home" : "away";
    while (otTime > 0 && ctx.homeScore === ctx.awayScore) {
      const isHome = otPossessor === "home";
      const offRatings = isHome ? ctx.homeRatings : ctx.awayRatings;
      const defRatings = isHome ? ctx.awayRatings : ctx.homeRatings;
      const offTeam = isHome ? homeT : awayT;
      const defTeam = isHome ? awayT : homeT;
      const drive = simulateDrive(otCtx, offTeam, defTeam, offRatings, defRatings, otTime);
      drives.push(drive);
      otTime -= drive.timeSec;
      if (isHome) {
        ctx.homeYards += drive.yards;
        ctx.homeTOP += drive.timeSec;
      } else {
        ctx.awayYards += drive.yards;
        ctx.awayTOP += drive.timeSec;
      }
      if (drive.result === "TD") {
        if (isHome) ctx.homeScore += 7; else ctx.awayScore += 7;
        break; // sudden death
      } else if (drive.result === "FG") {
        if (isHome) ctx.homeScore += 3; else ctx.awayScore += 3;
      }
      otPossessor = otPossessor === "home" ? "away" : "home";
    }
    // If still tied after OT, leave it
  }

  const homeBox = Array.from(ctx.homeBox.values());
  const awayBox = Array.from(ctx.awayBox.values());

  return {
    homeScore: ctx.homeScore,
    awayScore: ctx.awayScore,
    ot,
    drives,
    homeBox,
    awayBox,
    homeYards: ctx.homeYards,
    awayYards: ctx.awayYards,
    homeTOP: ctx.homeTOP,
    awayTOP: ctx.awayTOP,
    homeTO: ctx.homeTO,
    awayTO: ctx.awayTO,
    topPerformers: {
      home: pickTopPerformers(homeBox),
      away: pickTopPerformers(awayBox),
    },
    storyline: buildStoryline(ctx, homeT, awayT, ot),
  };
}

function simulateDrive(
  ctx: SimContext,
  offTeam: Team,
  defTeam: Team,
  offRatings: ReturnType<typeof teamSimRatings>,
  defRatings: ReturnType<typeof teamSimRatings>,
  timeRemaining: number,
): DriveLog {
  const rng = ctx.rng;

  // Offensive efficiency: blend QB, OL, skill vs DL, LB, DB
  const offRating = offRatings.qb * 0.30 + offRatings.ol * 0.22 +
                    offRatings.wr * 0.16 + offRatings.rb * 0.10 + offRatings.te * 0.08 +
                    offRatings.overall * 0.14;
  const defRating = defRatings.dl * 0.30 + defRatings.lb * 0.22 + defRatings.db * 0.30 +
                    defRatings.overall * 0.18;

  const advantage = (offRating - defRating); // typical -15..+15

  // Base outcome distribution
  let pTD = 0.20;
  let pFG = 0.17;
  let pINT = 0.07;
  let pFUM = 0.03;
  let pDowns = 0.04;
  // pPUNT = remainder

  // Apply advantage (each +1 advantage = +0.6% TD, +0.3% FG, -0.3% INT, etc.)
  const adv01 = advantage / 100; // small fraction
  pTD = clamp(pTD + adv01 * 0.5, 0.04, 0.55);
  pFG = clamp(pFG + adv01 * 0.2, 0.04, 0.30);
  pINT = clamp(pINT - adv01 * 0.2, 0.01, 0.18);
  pFUM = clamp(pFUM - adv01 * 0.05, 0.005, 0.10);
  pDowns = clamp(pDowns - adv01 * 0.05, 0.01, 0.10);

  // Home field nudge
  const isHomeOffense = offTeam.id === ctx.league.schedule[0]?.home || false; // approx; ignore
  // (We'll bake home field into ratings later if needed.)

  // End-of-game/half check: if very little time remains, could be EOH/EOG
  if (timeRemaining < 25) {
    return { team: offTeam.id, startYL: 25, result: "EOG", plays: 0, yards: 0, timeSec: timeRemaining, text: "End of game" };
  }

  // Pick result
  const r = rng.next();
  let result: DriveLog["result"];
  if (r < pTD) result = "TD";
  else if (r < pTD + pFG) result = "FG";
  else if (r < pTD + pFG + pINT) result = "INT";
  else if (r < pTD + pFG + pINT + pFUM) result = "FUM";
  else if (r < pTD + pFG + pINT + pFUM + pDowns) result = "DOWNS";
  else result = "PUNT";

  // Drive characteristics
  const startYL = clamp(Math.round(rng.normal(28, 8)), 15, 50);
  let yards = 0, plays = 0, timeSec = 0;

  switch (result) {
    case "TD":
      yards = 100 - startYL;
      plays = clamp(Math.round(rng.normal(8, 2)), 3, 15);
      timeSec = clamp(Math.round(rng.normal(180, 40)), 60, 360);
      break;
    case "FG":
      yards = clamp(Math.round(rng.normal(45, 12)), 5, 75);
      plays = clamp(Math.round(rng.normal(7, 2)), 3, 14);
      timeSec = clamp(Math.round(rng.normal(170, 40)), 60, 320);
      break;
    case "PUNT":
      yards = clamp(Math.round(rng.normal(15, 12)), -5, 60);
      plays = clamp(Math.round(rng.normal(5, 1.5)), 3, 12);
      timeSec = clamp(Math.round(rng.normal(150, 40)), 30, 320);
      break;
    case "INT":
      yards = clamp(Math.round(rng.normal(20, 12)), -5, 70);
      plays = clamp(Math.round(rng.normal(4, 1.5)), 1, 10);
      timeSec = clamp(Math.round(rng.normal(110, 30)), 20, 220);
      break;
    case "FUM":
      yards = clamp(Math.round(rng.normal(25, 14)), -5, 80);
      plays = clamp(Math.round(rng.normal(5, 1.5)), 1, 12);
      timeSec = clamp(Math.round(rng.normal(120, 30)), 20, 240);
      break;
    case "DOWNS":
      yards = clamp(Math.round(rng.normal(35, 12)), 0, 80);
      plays = clamp(Math.round(rng.normal(8, 2)), 4, 14);
      timeSec = clamp(Math.round(rng.normal(180, 40)), 60, 320);
      break;
  }

  // Cap yards at remaining field
  if (result !== "TD") yards = Math.min(yards, 100 - startYL - 1);

  // Cap time at remaining
  timeSec = Math.min(timeSec, timeRemaining);

  // Distribute stats among players
  distributePlayerStats(ctx, offTeam, defTeam, result, yards, plays, offRatings, defRatings);

  return {
    team: offTeam.id,
    startYL,
    result,
    plays,
    yards,
    timeSec,
    text: driveText(result, offTeam, defTeam, yards),
  };
}

function distributePlayerStats(
  ctx: SimContext,
  offTeam: Team,
  defTeam: Team,
  result: DriveLog["result"],
  yards: number,
  plays: number,
  offRatings: ReturnType<typeof teamSimRatings>,
  defRatings: ReturnType<typeof teamSimRatings>,
) {
  const rng = ctx.rng;
  const isOffHome = ctx.league.schedule.find((g) => g.home === offTeam.id) ? false : false; // simplified
  // We just pass offTeam id directly; box is by team, not by home/away. Determine by box map ownership.
  // Simpler: track by team id.
  const offBox = (id: string) => getBox(ctx, offTeam.id, id);
  const defBox = (id: string) => getBox(ctx, defTeam.id, id);

  // Coaching mods baked in: pass bias, completion mult, rush mult, big play, blitz...
  const isHomeOff = offTeam.id === ctx.homeTeamId;
  const offMods = isHomeOff ? ctx.homeOffMods : ctx.awayOffMods;
  const defMods = isHomeOff ? ctx.awayDefMods : ctx.homeDefMods;

  const passBase = 0.58 + offMods.passBias;
  const passRatio = clamp(passBase + rng.normal(0, 0.05), 0.30, 0.88);
  const passPlays = Math.round(plays * passRatio);
  const rushPlays = Math.max(0, plays - passPlays);

  const qbId = offRatings.qbId;
  const wrIds = offRatings.wrIds;
  const teIds = offRatings.teIds;
  const rbIds = offRatings.rbIds;

  // Allocate yards — weather suppresses passing more than running
  const passYardShare = result === "TD" || result === "FG" ? 0.6 : 0.55;
  const passYardsRaw = Math.round(yards * passYardShare * ctx.weatherMods.passYdsMult);
  const rushYardsRaw = Math.round(yards * (1 - passYardShare) * ctx.weatherMods.rushYdsMult);
  const passYards = Math.max(0, passYardsRaw);
  const rushYards = Math.max(0, rushYardsRaw);

  // QB stats
  if (qbId && passPlays > 0) {
    const qb = offBox(qbId);
    const completions = Math.round(passPlays * clamp(0.55 + (offRatings.qb - 70) * 0.005, 0.40, 0.78));
    qb.passAtt = (qb.passAtt ?? 0) + passPlays;
    qb.passCmp = (qb.passCmp ?? 0) + completions;
    qb.passYds = (qb.passYds ?? 0) + passYards;
    if (result === "TD") qb.passTd = (qb.passTd ?? 0) + 1;
    if (result === "INT") qb.passInt = (qb.passInt ?? 0) + 1;
  }

  // Distribute pass yards/receptions to WR/TE/RB
  const targets = [...wrIds.map((id, i) => ({ id, w: 4 - i })), ...teIds.map((id, i) => ({ id, w: 2 - i * 0.5 })), ...rbIds.map((id, i) => ({ id, w: 1.2 - i * 0.4 }))]
    .filter((t) => t.id && t.w > 0);

  for (let i = 0; i < passPlays; i++) {
    const target = rng.weighted(targets, targets.map((t) => t.w));
    const isCatch = rng.chance(0.6);
    const yardsOnPlay = Math.max(0, Math.round(passYards / Math.max(passPlays, 1) + rng.normal(0, 4)));
    const rec = offBox(target.id);
    rec.tgt = (rec.tgt ?? 0) + 1;
    if (isCatch) {
      rec.rec = (rec.rec ?? 0) + 1;
      rec.recYds = (rec.recYds ?? 0) + yardsOnPlay;
      if (result === "TD" && i === passPlays - 1) {
        rec.recTd = (rec.recTd ?? 0) + 1;
      }
    }
  }

  // Distribute rush attempts among RBs (and a few QB rushes)
  const rusherIds = [...rbIds];
  if (qbId && rng.chance(0.15)) rusherIds.push(qbId);
  if (rusherIds.length === 0 && qbId) rusherIds.push(qbId);

  for (let i = 0; i < rushPlays; i++) {
    const id = rusherIds.length > 0 ? rng.weighted(rusherIds, rusherIds.map((_, idx) => Math.max(1, rusherIds.length - idx))) : qbId;
    if (!id) continue;
    const rusher = offBox(id);
    const yds = Math.max(-2, Math.round(rushYards / Math.max(rushPlays, 1) + rng.normal(0, 2.5)));
    rusher.rushAtt = (rusher.rushAtt ?? 0) + 1;
    rusher.rushYds = (rusher.rushYds ?? 0) + yds;
    if (result === "TD" && i === rushPlays - 1 && rng.chance(0.5)) {
      rusher.rushTd = (rusher.rushTd ?? 0) + 1;
      // If RB scores, take TD off QB
      if (qbId) {
        const qb = offBox(qbId);
        if ((qb.passTd ?? 0) > 0) qb.passTd = (qb.passTd ?? 0) - 1;
      }
    }
  }

  // Defensive stats — distribute tackles among LBs and DBs
  const dlPlayers = [...defRatings.dlIds];
  const lbPlayers = [...defRatings.lbIds];
  const dbPlayers = [...defRatings.dbIds];
  const allDef = [...dlPlayers, ...lbPlayers, ...dbPlayers];
  const tackleCount = Math.max(2, Math.round(plays * 0.5));
  for (let i = 0; i < tackleCount; i++) {
    if (!allDef.length) break;
    const id = rng.pick(allDef);
    const stat = defBox(id);
    stat.tackles = (stat.tackles ?? 0) + 1;
  }
  // Sacks chance — defense's blitz rate + offensive protection mod
  const blitzMod = (defMods.blitzRate - 0.5) * 0.12;
  const sackProb = clamp(0.18 + (defRatings.dl - 70) * 0.01 + blitzMod - offMods.protectionMod, 0.05, 0.45);
  if (passPlays > 0 && rng.chance(sackProb)) {
    const id = rng.pick(dlPlayers.concat(lbPlayers).filter(Boolean));
    if (id) {
      const stat = defBox(id);
      stat.sacks = (stat.sacks ?? 0) + 1;
    }
  }
  // INT credit
  if (result === "INT") {
    const id = rng.pick(dbPlayers.concat(lbPlayers).filter(Boolean));
    if (id) {
      const stat = defBox(id);
      stat.ints = (stat.ints ?? 0) + 1;
    }
  }
  // Forced fumble
  if (result === "FUM") {
    const id = rng.pick(allDef);
    if (id) {
      const stat = defBox(id);
      stat.ffum = (stat.ffum ?? 0) + 1;
    }
  }

  // Field goal: credit kicker
  if (result === "FG") {
    const k = offRatings.kId;
    if (k) {
      const ks = offBox(k);
      ks.fgm = (ks.fgm ?? 0) + 1;
      ks.fga = (ks.fga ?? 0) + 1;
    }
  }
  // Extra point on TD
  if (result === "TD") {
    const k = offRatings.kId;
    if (k) {
      const ks = offBox(k);
      ks.xpm = (ks.xpm ?? 0) + 1;
      ks.xpa = (ks.xpa ?? 0) + 1;
    }
  }
}

function getBox(ctx: SimContext, teamId: string, playerId: string): BoxStat {
  // Look up which side this team is on for the current game.
  // Simple heuristic: if team matches first ratings (homeRatings.qbId belongs to home roster), use homeBox.
  const homeIds = new Set([
    ctx.homeRatings.qbId, ...ctx.homeRatings.rbIds, ...ctx.homeRatings.wrIds,
    ...ctx.homeRatings.teIds, ...ctx.homeRatings.olIds, ...ctx.homeRatings.dlIds,
    ...ctx.homeRatings.lbIds, ...ctx.homeRatings.dbIds,
    ctx.homeRatings.kId, ctx.homeRatings.pId,
  ]);
  const map = homeIds.has(playerId) ? ctx.homeBox : ctx.awayBox;
  let s = map.get(playerId);
  if (!s) {
    s = { playerId };
    map.set(playerId, s);
  }
  return s;
}

function pickTopPerformers(box: BoxStat[]): string[] {
  const score = (b: BoxStat) =>
    (b.passYds ?? 0) * 0.04 + (b.passTd ?? 0) * 6 +
    (b.rushYds ?? 0) * 0.1 + (b.rushTd ?? 0) * 6 +
    (b.recYds ?? 0) * 0.1 + (b.recTd ?? 0) * 6 +
    (b.tackles ?? 0) * 0.7 + (b.sacks ?? 0) * 4 + (b.ints ?? 0) * 5 + (b.ffum ?? 0) * 3;
  return [...box].sort((a, b) => score(b) - score(a)).slice(0, 3).map((b) => b.playerId);
}

function driveText(result: DriveLog["result"], off: Team, def: Team, yards: number): string {
  switch (result) {
    case "TD": return `${off.abbr} marches ${yards} yards for a touchdown`;
    case "FG": return `${off.abbr} field goal after a ${yards}-yard drive`;
    case "PUNT": return `${off.abbr} forced to punt`;
    case "INT": return `${off.abbr} QB intercepted by ${def.abbr}`;
    case "FUM": return `${off.abbr} fumbles, recovered by ${def.abbr}`;
    case "DOWNS": return `${off.abbr} turnover on downs`;
    case "EOH": return "End of half";
    case "EOG": return "End of game";
  }
}

function buildStoryline(ctx: SimContext, home: Team, away: Team, ot: boolean): string {
  const margin = Math.abs(ctx.homeScore - ctx.awayScore);
  const winner = ctx.homeScore > ctx.awayScore ? home : away;
  const loser = ctx.homeScore > ctx.awayScore ? away : home;
  if (ot) return `${winner.name} edge ${loser.name} ${Math.max(ctx.homeScore, ctx.awayScore)}–${Math.min(ctx.homeScore, ctx.awayScore)} in overtime.`;
  if (margin >= 24) return `${winner.name} demolish ${loser.name} ${Math.max(ctx.homeScore, ctx.awayScore)}–${Math.min(ctx.homeScore, ctx.awayScore)}.`;
  if (margin <= 3) return `${winner.name} hold off ${loser.name} ${Math.max(ctx.homeScore, ctx.awayScore)}–${Math.min(ctx.homeScore, ctx.awayScore)} in a nail-biter.`;
  return `${winner.name} beat ${loser.name} ${Math.max(ctx.homeScore, ctx.awayScore)}–${Math.min(ctx.homeScore, ctx.awayScore)}.`;
}
