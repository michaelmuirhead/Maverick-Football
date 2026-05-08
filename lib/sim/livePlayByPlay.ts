import { RNG } from "@/lib/rng";
import type { BoxStat, DriveLog, Game, GameResult, League, Player, Weather } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { teamSimRatings } from "@/lib/gen/roster";
import { personalityFor } from "@/lib/cpu/personalities";
import { offensiveMods, defensiveMods, ensureGamePlan, type CoachingMods } from "@/lib/cpu/gamePlan";
import { rollWeather, weatherModifiers, hfaBoost } from "@/lib/cpu/weather";
import { chemistryActiveBonus } from "@/lib/cpu/chemistry";
import { clamp } from "@/lib/utils";

// =====================================================================
// Play-by-play simulation. Yields LiveEvent for each play; returns the
// final GameResult so it can be saved to the league exactly like the
// fast drive-sim. Use as: const gen = createLiveGame(...); for (...).
// =====================================================================

export type LiveEventKind =
  | "kickoff" | "play" | "punt" | "fg" | "xp" | "twoPt"
  | "td" | "safety" | "turnover" | "sack" | "incomplete" | "complete"
  | "rush" | "firstDown" | "periodEnd" | "timeout" | "twoMinute"
  | "endRegulation" | "endOT" | "kneel" | "spike";

export interface LiveGameState {
  qtr: 1 | 2 | 3 | 4 | 5;        // 5 = OT
  secLeft: number;               // remaining in current quarter (or OT)
  homeScore: number;
  awayScore: number;
  possession: string;            // team id with the ball (offense)
  ballYL: number;                // 1–99 from offense's perspective: 25 = own 25
  down: 1 | 2 | 3 | 4;
  toGo: number;                  // yards to first down
  driveStartYL: number;          // own YL where drive began
  drivePlays: number;
  homeTimeouts: number;
  awayTimeouts: number;
  driveLog: DriveLog[];          // accumulated drives
  homeBox: BoxStat[];            // accumulated stats
  awayBox: BoxStat[];
  homeYards: number;
  awayYards: number;
  homeTOP: number;
  awayTOP: number;
  homeTO: number;                // turnovers committed by home
  awayTO: number;
}

export interface LiveEvent {
  kind: LiveEventKind;
  description: string;
  bigPlay: boolean;
  state: LiveGameState;          // snapshot AFTER this event
  scoreChange?: { home: number; away: number };
}

interface InternalState extends LiveGameState {
  // private bookkeeping
  driveYards: number;
  driveTime: number;
  driveStartPossession: string;
  driveScorerId?: string;
  homeTeamId: string;
  awayTeamId: string;
  league: League;
  weather?: Weather;
  weatherMods: ReturnType<typeof weatherModifiers>;
  homeHfa: number;
  // cached coaching modifiers per side
  homeOffMods: CoachingMods;
  homeDefMods: CoachingMods;
  awayOffMods: CoachingMods;
  awayDefMods: CoachingMods;
  twoMinAnnounced?: boolean;
  _otSuddenDeath?: boolean;
}

function offModsFor(state: InternalState, teamId: string): CoachingMods {
  return teamId === state.homeTeamId ? state.homeOffMods : state.awayOffMods;
}
function defModsFor(state: InternalState, teamId: string): CoachingMods {
  return teamId === state.homeTeamId ? state.homeDefMods : state.awayDefMods;
}

const QUARTER_SEC = 15 * 60;
const OT_SEC = 10 * 60;

export function createLiveGame(league: League, game: Game, rngSeed: string): Generator<LiveEvent, GameResult, void> {
  return liveGen(league, game, rngSeed);
}

function* liveGen(league: League, game: Game, rngSeed: string): Generator<LiveEvent, GameResult, void> {
  const rng = new RNG(`live:${rngSeed}:${game.id}`);
  const homeT = TEAMS_BY_ID[game.home];
  const awayT = TEAMS_BY_ID[game.away];
  const homeR = teamSimRatings(league, homeT.id);
  const awayR = teamSimRatings(league, awayT.id);

  // Ensure both teams have a game plan (CPU auto-generates; user's may already exist)
  ensureGamePlan(league, game.id, homeT.id, awayT.id);
  ensureGamePlan(league, game.id, awayT.id, homeT.id);

  // Roll weather (no-op if already rolled)
  const weather = rollWeather(league, game);
  const weatherMods = weatherModifiers(weather);
  const homeHfa = hfaBoost(homeT);

  // Cache coaching mods (personality + coach + game plan) for both sides
  const homeOffMods = offensiveMods(league, homeT.id, game.id);
  const homeDefMods = defensiveMods(league, homeT.id, game.id);
  const awayOffMods = offensiveMods(league, awayT.id, game.id);
  const awayDefMods = defensiveMods(league, awayT.id, game.id);

  // Coin toss — winner receives second half by tradition; we'll keep simple
  const homeReceivesFirst = rng.chance(0.5);

  const state: InternalState = {
    qtr: 1,
    secLeft: QUARTER_SEC,
    homeScore: 0,
    awayScore: 0,
    possession: homeReceivesFirst ? homeT.id : awayT.id,
    ballYL: 25,
    down: 1,
    toGo: 10,
    driveStartYL: 25,
    drivePlays: 0,
    homeTimeouts: 3,
    awayTimeouts: 3,
    driveLog: [],
    homeBox: [],
    awayBox: [],
    homeYards: 0,
    awayYards: 0,
    homeTOP: 0,
    awayTOP: 0,
    homeTO: 0,
    awayTO: 0,
    driveYards: 0,
    driveTime: 0,
    driveStartPossession: homeReceivesFirst ? homeT.id : awayT.id,
    homeTeamId: homeT.id,
    awayTeamId: awayT.id,
    league,
    weather,
    weatherMods,
    homeHfa,
    homeOffMods, homeDefMods, awayOffMods, awayDefMods,
  };

  yield event(state, "kickoff", `${TEAMS_BY_ID[state.possession].name} receive the opening kickoff. Ball at the ${state.ballYL}-yard line.`, true);

  // Main loop — run plays until end of regulation / OT
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const isHome = state.possession === homeT.id;
    const off = isHome ? homeR : awayR;
    const def = isHome ? awayR : homeR;
    const offTeam = isHome ? homeT : awayT;
    const defTeam = isHome ? awayT : homeT;

    // 2-minute warning
    if ((state.qtr === 2 || state.qtr === 4) && !state.twoMinAnnounced && state.secLeft <= 120) {
      state.twoMinAnnounced = true;
      yield event(state, "twoMinute", `Two-minute warning.`, true);
    }

    // Kneel-down check (winning, < 2 min, in own territory)
    if (shouldKneel(state, isHome)) {
      yield* kneelPlay(state, off, def, offTeam, rng);
    }
    // Spike check (no timeouts, near end of half/game, need to stop clock)
    else if (shouldSpike(state)) {
      yield* spikePlay(state, off, offTeam, rng);
    }
    else if (state.down === 4) {
      // 4th down: punt / FG / go
      const decision = decideFourthDown(state, isHome);
      if (decision === "punt") {
        yield* puntPlay(state, off, def, offTeam, defTeam, rng);
      } else if (decision === "fg") {
        yield* fieldGoalAttempt(state, off, offTeam, defTeam, rng, homeT.id);
      } else {
        // go for it
        yield* runOrPass(state, off, def, offTeam, defTeam, rng, homeT.id, awayT.id);
      }
    } else {
      yield* runOrPass(state, off, def, offTeam, defTeam, rng, homeT.id, awayT.id);
    }

    // End of period detection
    if (state.secLeft <= 0) {
      const isOT = state.qtr === 5;
      // Close out current drive into log if mid-drive
      flushDrive(state, "EOH");
      if (state.qtr === 4) {
        if (state.homeScore !== state.awayScore) {
          yield event(state, "endRegulation", `End of regulation. Final: ${awayT.abbr} ${state.awayScore}, ${homeT.abbr} ${state.homeScore}.`, true);
          break;
        } else {
          state.qtr = 5;
          state.secLeft = OT_SEC;
          state.homeTimeouts = 2;
          state.awayTimeouts = 2;
          state.possession = rng.chance(0.5) ? homeT.id : awayT.id;
          state.ballYL = 25;
          state.down = 1; state.toGo = 10;
          state.driveStartYL = 25; state.drivePlays = 0;
          state.driveYards = 0; state.driveTime = 0;
          state.driveStartPossession = state.possession;
          yield event(state, "periodEnd", `Tied at the end of regulation — going to overtime.`, true);
        }
      } else if (state.qtr === 5) {
        // OT ended without sudden death win — leave tied
        yield event(state, "endOT", `End of overtime. Final: ${awayT.abbr} ${state.awayScore}, ${homeT.abbr} ${state.homeScore}.`, true);
        break;
      } else {
        const next = (state.qtr + 1) as 1 | 2 | 3 | 4 | 5;
        yield event(state, "periodEnd", `End of Q${state.qtr}.`, false);
        state.qtr = next;
        state.secLeft = QUARTER_SEC;
        if (next === 3) {
          // Other team gets ball at start of second half
          state.possession = homeReceivesFirst ? awayT.id : homeT.id;
          state.ballYL = 25;
          state.down = 1; state.toGo = 10;
          state.driveStartYL = 25; state.drivePlays = 0;
          state.driveYards = 0; state.driveTime = 0;
          state.driveStartPossession = state.possession;
          yield event(state, "kickoff", `Second-half kickoff to ${TEAMS_BY_ID[state.possession].name}.`, false);
        }
        if (next === 2 || next === 4) {
          state.twoMinAnnounced = false;
        }
      }
    }

    // OT sudden-death TD ends game
    if (state.qtr === 5 && state._otSuddenDeath) {
      yield event(state, "endOT", `Walk-off! Final: ${awayT.abbr} ${state.awayScore}, ${homeT.abbr} ${state.homeScore}.`, true);
      break;
    }
  }

  // Build final GameResult
  const ot = state.qtr === 5;
  const result: GameResult = {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    ot,
    drives: state.driveLog,
    homeBox: state.homeBox,
    awayBox: state.awayBox,
    homeYards: state.homeYards,
    awayYards: state.awayYards,
    homeTOP: state.homeTOP,
    awayTOP: state.awayTOP,
    homeTO: state.homeTO,
    awayTO: state.awayTO,
    topPerformers: {
      home: pickTop(state.homeBox),
      away: pickTop(state.awayBox),
    },
    storyline: storyline(homeT, awayT, state.homeScore, state.awayScore, ot),
  };
  return result;
}

// ========== Play resolvers ==========

function* runOrPass(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  def: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  rng: RNG,
  homeId: string,
  awayId: string,
): Generator<LiveEvent, void, void> {
  const isHome = offTeam.id === homeId;
  // Decide pass or run
  const passProb = computePassProb(state);
  const isPass = rng.chance(passProb);

  if (isPass) {
    yield* passPlay(state, off, def, offTeam, defTeam, rng, homeId, awayId);
  } else {
    yield* runPlay(state, off, def, offTeam, defTeam, rng, homeId, awayId);
  }
}

function computePassProb(state: InternalState): number {
  let p = 0.55;
  if (state.toGo >= 7) p += 0.15;
  if (state.toGo <= 2) p -= 0.20;
  if (state.ballYL >= 95) p -= 0.25;          // goal line pounding

  // Combined coaching + scheme + game-plan bias
  const mods = offModsFor(state, state.possession);
  p += mods.passBias;

  // Late-game trailing → more pass
  const offIsHome = state.possession === state.homeTeamId;
  const offScore = offIsHome ? state.homeScore : state.awayScore;
  const defScore = offIsHome ? state.awayScore : state.homeScore;
  if ((state.qtr >= 4) && offScore < defScore) p += 0.18;
  return clamp(p, 0.18, 0.92);
}

function* passPlay(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  def: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  rng: RNG,
  homeId: string,
  awayId: string,
): Generator<LiveEvent, void, void> {
  state.drivePlays++;

  const qbId = off.qbId!;
  const qbBox = getBox(state, offTeam.id === homeId, qbId);

  const advantage = off.qb + off.ol - def.dl - def.db / 2;

  // Sack chance — defense's blitz rate + offensive protection mod
  const dMods = defModsFor(state, defTeam.id);
  const oMods = offModsFor(state, offTeam.id);
  const blitzMod = (dMods.blitzRate - 0.5) * 0.08;     // ±0.04
  const sackP = clamp(0.05 + (def.dl - off.ol) * 0.005 + blitzMod - oMods.protectionMod, 0.02, 0.22);
  if (rng.chance(sackP)) {
    const sackYds = -clamp(Math.round(rng.normal(7, 3)), 1, 18);
    qbBox.passAtt = (qbBox.passAtt ?? 0) + 1;
    state.ballYL = clamp(state.ballYL + sackYds, 1, 99);
    state.toGo -= sackYds;
    state.down = (state.down + 1) as 1 | 2 | 3 | 4;
    const sackerId = rng.pick([...off.dlIds, ...off.lbIds].length ? [...def.dlIds, ...def.lbIds] : [def.dbIds[0]]);
    if (sackerId) {
      const ds = getBox(state, offTeam.id !== homeId, sackerId);
      ds.sacks = (ds.sacks ?? 0) + 1;
      ds.tackles = (ds.tackles ?? 0) + 1;
    }
    addOffYards(state, sackYds);
    advanceClock(state, 35);
    accumulateDriveTime(state, 35, sackYds);
    yield event(state, "sack", `${offTeam.abbr} sacked for ${Math.abs(sackYds)} yards.`, false);

    // Check downs / drive end
    if (state.down > 4 && state.toGo > 0) {
      yield* turnoverOnDowns(state, offTeam, defTeam, homeId, awayId);
    }
    return;
  }

  // INT chance — modded by offensive ball security
  const intP = clamp(0.025 + (def.db - off.qb) * 0.0015 + oMods.interceptionMod, 0.005, 0.10);
  if (rng.chance(intP)) {
    qbBox.passAtt = (qbBox.passAtt ?? 0) + 1;
    qbBox.passInt = (qbBox.passInt ?? 0) + 1;
    const dbId = rng.pick(def.dbIds.concat(def.lbIds).filter(Boolean));
    if (dbId) {
      const ds = getBox(state, offTeam.id !== homeId, dbId);
      ds.ints = (ds.ints ?? 0) + 1;
    }
    advanceClock(state, 18);
    accumulateDriveTime(state, 18, 0);
    yield event(state, "turnover", `Intercepted by ${defTeam.abbr}!`, true);
    yield* turnover(state, offTeam, defTeam, homeId, awayId, "INT");
    return;
  }

  // Choose target & catch?
  const targets: { id: string; w: number }[] = [
    ...(off.wrIds.map((id, i) => ({ id, w: 5 - i }))),
    ...(off.teIds.map((id, i) => ({ id, w: 2.5 - i * 0.6 }))),
    ...(off.rbIds.map((id, i) => ({ id, w: 1.5 - i * 0.5 }))),
  ].filter((t) => t.id && t.w > 0);

  // Game plan: featured player gets +60% target weight; shadowed opponents irrelevant here
  if (oMods.featuredPlayerId) {
    const f = targets.find((t) => t.id === oMods.featuredPlayerId);
    if (f) f.w *= 1.6;
  }
  // Defensive shadow on a player reduces their target share (defense is keying on them)
  if (dMods.shadowPlayerId) {
    const s = targets.find((t) => t.id === dMods.shadowPlayerId);
    if (s) s.w *= 0.55;
  }

  const target = rng.weighted(targets, targets.map((t) => t.w));
  const recBox = getBox(state, offTeam.id === homeId, target.id);
  recBox.tgt = (recBox.tgt ?? 0) + 1;
  qbBox.passAtt = (qbBox.passAtt ?? 0) + 1;

  // Completion chance — coaches + weather + chemistry on both sides
  const catchPRaw = 0.55 + (off.qb + off.wr - def.db) * 0.005;
  const chemistry = chemistryActiveBonus(state.league, qbId, target.id);
  const weatherCatchPenalty = state.weatherMods.passYdsMult < 1
    ? (1 - state.weatherMods.passYdsMult) * 0.4
    : 0;
  const catchP = clamp(
    catchPRaw * (oMods.completionMult / dMods.completionMult) + chemistry - weatherCatchPenalty,
    0.20, 0.92,
  );
  const completed = rng.chance(catchP);
  if (!completed) {
    advanceClock(state, 6);
    accumulateDriveTime(state, 6, 0);
    state.down = (state.down + 1) as 1 | 2 | 3 | 4;
    yield event(state, "incomplete", `${offTeam.abbr} pass incomplete.`, false);
    if (state.down > 4) {
      yield* turnoverOnDowns(state, offTeam, defTeam, homeId, awayId);
    }
    return;
  }

  // Yards on completion — big play chance modded by both sides + weather suppression
  const baseYds = clamp(Math.round(rng.normal(7.6, 4) * state.weatherMods.passYdsMult), -2, 25);
  const bigPlayChance = clamp(
    (0.07 + oMods.bigPlayBonus + dMods.bigPlayConcedeBonus) * state.weatherMods.bigPlayMult,
    0.01, 0.18,
  );
  const bigPlay = rng.chance(bigPlayChance);
  const ydsAfter = bigPlay
    ? clamp(Math.round(rng.normal(20, 12) * state.weatherMods.passYdsMult), 5, 65)
    : 0;
  const yds = clamp(baseYds + ydsAfter, -3, 99);

  qbBox.passCmp = (qbBox.passCmp ?? 0) + 1;
  qbBox.passYds = (qbBox.passYds ?? 0) + yds;
  recBox.rec = (recBox.rec ?? 0) + 1;
  recBox.recYds = (recBox.recYds ?? 0) + yds;

  // Scoring?
  const newYL = state.ballYL + yds;
  if (newYL >= 100) {
    qbBox.passTd = (qbBox.passTd ?? 0) + 1;
    recBox.recTd = (recBox.recTd ?? 0) + 1;
    addOffYards(state, 100 - state.ballYL);
    yield* touchdown(state, offTeam, defTeam, homeId, awayId, target.id);
    return;
  }

  state.ballYL = newYL;
  state.toGo -= yds;
  addOffYards(state, yds);

  const tackler = rng.pick(def.dbIds.concat(def.lbIds).filter(Boolean));
  if (tackler) {
    const ds = getBox(state, offTeam.id !== homeId, tackler);
    ds.tackles = (ds.tackles ?? 0) + 1;
  }

  let firstDown = false;
  if (state.toGo <= 0) {
    firstDown = true;
    state.down = 1;
    state.toGo = Math.min(10, 100 - state.ballYL);
  } else {
    state.down = (state.down + 1) as 1 | 2 | 3 | 4;
  }
  const time = bigPlay ? 22 : 30;
  advanceClock(state, time);
  accumulateDriveTime(state, time, yds);

  const player = lookupName(state, target.id);
  const desc = bigPlay
    ? `${offTeam.abbr} BIG PLAY — ${player} catches for ${yds} yards${firstDown ? " (first down)" : ""}.`
    : `${offTeam.abbr} ${player} catches for ${yds} yards${firstDown ? " (first down)" : ""}.`;
  yield event(state, "complete", desc, bigPlay || firstDown);

  if (state.down > 4 && state.toGo > 0) {
    yield* turnoverOnDowns(state, offTeam, defTeam, homeId, awayId);
  }
}

function* runPlay(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  def: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  rng: RNG,
  homeId: string,
  awayId: string,
): Generator<LiveEvent, void, void> {
  state.drivePlays++;

  const oMods = offModsFor(state, offTeam.id);
  const dMods = defModsFor(state, defTeam.id);

  // Pick rusher: ~85% RB1, 12% RB2, 3% QB sneak. Featured player override.
  const r = rng.next();
  let rusherId: string | undefined;
  if (oMods.featuredPlayerId && off.rbIds.includes(oMods.featuredPlayerId)) {
    rusherId = r < 0.92 ? oMods.featuredPlayerId : off.rbIds.find((id) => id !== oMods.featuredPlayerId) ?? off.qbId;
  } else if (r < 0.85) rusherId = off.rbIds[0];
  else if (r < 0.97) rusherId = off.rbIds[1] ?? off.rbIds[0];
  else rusherId = off.qbId;
  if (!rusherId) rusherId = off.rbIds[0] ?? off.qbId;
  if (!rusherId) {
    // No rusher — fallback incomplete
    yield event(state, "incomplete", `Play broken up.`, false);
    return;
  }
  const rusherBox = getBox(state, offTeam.id === homeId, rusherId);

  // Fumble chance — weather adds to slip
  if (rng.chance(0.014 + state.weatherMods.fumbleBonus)) {
    rusherBox.rushAtt = (rusherBox.rushAtt ?? 0) + 1;
    advanceClock(state, 8);
    accumulateDriveTime(state, 8, 0);
    yield event(state, "turnover", `${offTeam.abbr} FUMBLES! Recovered by ${defTeam.abbr}.`, true);
    const ffId = rng.pick(def.dlIds.concat(def.lbIds).filter(Boolean));
    if (ffId) {
      const ds = getBox(state, offTeam.id !== homeId, ffId);
      ds.ffum = (ds.ffum ?? 0) + 1;
    }
    yield* turnover(state, offTeam, defTeam, homeId, awayId, "FUM");
    return;
  }

  // Yards — applies offensive rush mult, defensive run-stuff mult, and weather
  const advantage = (off.rb + off.ol - def.dl - def.lb) / 4;
  const yardsMult = (oMods.rushYpcMult / dMods.rushYpcMult) * state.weatherMods.rushYdsMult;
  const mean = (4.2 + advantage * 0.06) * yardsMult;
  const isBigRun = rng.chance(clamp(0.05 + oMods.bigPlayBonus * 0.5, 0.02, 0.10) * state.weatherMods.bigPlayMult);
  const baseYds = clamp(Math.round(rng.normal(mean, 3)), -3, 14);
  const bigBonus = isBigRun ? clamp(Math.round(rng.normal(20, 10)), 5, 60) : 0;
  const yds = baseYds + bigBonus;

  rusherBox.rushAtt = (rusherBox.rushAtt ?? 0) + 1;
  rusherBox.rushYds = (rusherBox.rushYds ?? 0) + yds;

  const newYL = state.ballYL + yds;
  if (newYL >= 100) {
    rusherBox.rushTd = (rusherBox.rushTd ?? 0) + 1;
    addOffYards(state, 100 - state.ballYL);
    yield* touchdown(state, offTeam, defTeam, homeId, awayId, rusherId);
    return;
  }

  state.ballYL = newYL;
  state.toGo -= yds;
  addOffYards(state, yds);

  const tackler = rng.pick(def.lbIds.concat(def.dlIds, def.dbIds).filter(Boolean));
  if (tackler) {
    const ds = getBox(state, offTeam.id !== homeId, tackler);
    ds.tackles = (ds.tackles ?? 0) + 1;
  }

  let firstDown = false;
  if (state.toGo <= 0) {
    firstDown = true;
    state.down = 1;
    state.toGo = Math.min(10, 100 - state.ballYL);
  } else {
    state.down = (state.down + 1) as 1 | 2 | 3 | 4;
  }

  const time = isBigRun ? 25 : 38;
  advanceClock(state, time);
  accumulateDriveTime(state, time, yds);

  const player = lookupName(state, rusherId);
  const desc = isBigRun
    ? `${offTeam.abbr} ${player} BREAKS LOOSE for ${yds} yards${firstDown ? " (first down)" : ""}.`
    : `${offTeam.abbr} ${player} runs for ${yds} yards${firstDown ? " (first down)" : ""}.`;
  yield event(state, "rush", desc, isBigRun || firstDown);

  if (state.down > 4 && state.toGo > 0) {
    yield* turnoverOnDowns(state, offTeam, defTeam, homeId, awayId);
  }
}

function* puntPlay(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  def: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  rng: RNG,
): Generator<LiveEvent, void, void> {
  const puntDist = clamp(Math.round(rng.normal(45, 7)), 25, 65);
  state.drivePlays++;
  flushDrive(state, "PUNT");
  advanceClock(state, 14);

  const newYL = clamp(100 - (state.ballYL + puntDist) + clamp(Math.round(rng.normal(7, 5)), 0, 25), 1, 99);
  state.possession = defTeam.id;
  state.ballYL = newYL;
  state.down = 1;
  state.toGo = 10;
  state.driveStartYL = newYL;
  state.driveStartPossession = defTeam.id;
  state.drivePlays = 0;
  state.driveYards = 0;
  state.driveTime = 0;

  yield event(state, "punt", `${offTeam.abbr} punts ${puntDist} yards. ${defTeam.abbr} ball at the ${state.ballYL}.`, false);
}

function* fieldGoalAttempt(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  rng: RNG,
  homeId: string,
): Generator<LiveEvent, void, void> {
  const dist = (100 - state.ballYL) + 17 + state.weatherMods.fgRangePenalty; // weather makes it effectively longer
  const baseAcc = (off.kOvr - 50) / 50; // 0..~0.9
  // Closer = easier
  const distFactor = clamp(1 - (dist - 30) / 60, 0.05, 0.99);
  const makeP = clamp(0.55 + baseAcc * 0.4 * distFactor, 0.15, 0.99);
  const made = rng.chance(makeP);
  const kId = off.kId;
  if (kId) {
    const kb = getBox(state, offTeam.id === homeId, kId);
    kb.fga = (kb.fga ?? 0) + 1;
    if (made) kb.fgm = (kb.fgm ?? 0) + 1;
  }

  state.drivePlays++;
  advanceClock(state, 5);
  accumulateDriveTime(state, 5, 0);

  if (made) {
    if (offTeam.id === homeId) state.homeScore += 3; else state.awayScore += 3;
    flushDrive(state, "FG");
    yield event(state, "fg", `${offTeam.abbr} ${dist}-yard field goal is GOOD.`, true);
    yield* kickoff(state, offTeam, defTeam, homeId);
  } else {
    flushDrive(state, "DOWNS");
    state.possession = defTeam.id;
    const spotYL = clamp(100 - state.ballYL + 7, 1, 99);
    state.ballYL = spotYL;
    state.down = 1;
    state.toGo = 10;
    state.driveStartYL = spotYL;
    state.driveStartPossession = defTeam.id;
    state.drivePlays = 0;
    state.driveYards = 0;
    state.driveTime = 0;
    yield event(state, "fg", `${offTeam.abbr} ${dist}-yard field goal is NO GOOD. ${defTeam.abbr} takes over.`, true);
  }
}

function* touchdown(
  state: InternalState,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  homeId: string,
  awayId: string,
  scorerId: string,
): Generator<LiveEvent, void, void> {
  if (offTeam.id === homeId) state.homeScore += 6; else state.awayScore += 6;
  state.driveScorerId = scorerId;
  flushDrive(state, "TD", scorerId);
  state.ballYL = 97;
  advanceClock(state, 12);
  yield event(state, "td", `TOUCHDOWN ${offTeam.abbr}! ${lookupName(state, scorerId)} finds the end zone.`, true, { home: 0, away: 0 });

  // Extra point — almost always (95%); 2pt if late & trailing
  const offIsHome = offTeam.id === homeId;
  const offScore = offIsHome ? state.homeScore : state.awayScore;
  const defScore = offIsHome ? state.awayScore : state.homeScore;
  const trailing = (offScore - 6) < defScore;
  const goingForTwo = state.qtr >= 4 && state.secLeft <= 300 && trailing;

  if (goingForTwo) {
    const success = Math.random() < 0.48;
    if (success) {
      if (offIsHome) state.homeScore += 2; else state.awayScore += 2;
      yield event(state, "twoPt", `Two-point conversion is GOOD. ${defTeam.abbr} ${offIsHome ? state.awayScore : state.homeScore} – ${offTeam.abbr} ${offIsHome ? state.homeScore : state.awayScore}.`, true);
    } else {
      yield event(state, "twoPt", `Two-point conversion FAILS.`, true);
    }
  } else {
    if (offIsHome) state.homeScore += 1; else state.awayScore += 1;
    yield event(state, "xp", `Extra point is good.`, false);
  }

  // OT sudden death TD ends game
  if (state.qtr === 5) {
    (state as any)._otSuddenDeath = true;
    return;
  }
  yield* kickoff(state, offTeam, defTeam, homeId);
}

function* kickoff(
  state: InternalState,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  homeId: string,
): Generator<LiveEvent, void, void> {
  state.possession = defTeam.id;
  state.ballYL = 25;
  state.down = 1;
  state.toGo = 10;
  state.driveStartYL = 25;
  state.driveStartPossession = defTeam.id;
  state.drivePlays = 0;
  state.driveYards = 0;
  state.driveTime = 0;
  yield event(state, "kickoff", `Kickoff. ${defTeam.abbr} takes over at the 25.`, false);
}

function* turnover(
  state: InternalState,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  homeId: string,
  awayId: string,
  kind: "INT" | "FUM",
): Generator<LiveEvent, void, void> {
  if (offTeam.id === homeId) state.homeTO++; else state.awayTO++;
  flushDrive(state, kind);
  state.possession = defTeam.id;
  state.ballYL = clamp(100 - state.ballYL + 5, 1, 99);
  state.down = 1;
  state.toGo = 10;
  state.driveStartYL = state.ballYL;
  state.driveStartPossession = defTeam.id;
  state.drivePlays = 0;
  state.driveYards = 0;
  state.driveTime = 0;
  // No additional event — caller already announced the turnover
}

function* turnoverOnDowns(
  state: InternalState,
  offTeam: { id: string; abbr: string; name: string },
  defTeam: { id: string; abbr: string; name: string },
  homeId: string,
  awayId: string,
): Generator<LiveEvent, void, void> {
  flushDrive(state, "DOWNS");
  state.possession = defTeam.id;
  state.ballYL = clamp(100 - state.ballYL, 1, 99);
  state.down = 1;
  state.toGo = 10;
  state.driveStartYL = state.ballYL;
  state.driveStartPossession = defTeam.id;
  state.drivePlays = 0;
  state.driveYards = 0;
  state.driveTime = 0;
  yield event(state, "turnover", `${offTeam.abbr} turn it over on downs.`, true);
}

function* kneelPlay(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  def: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  rng: RNG,
): Generator<LiveEvent, void, void> {
  state.drivePlays++;
  state.ballYL = clamp(state.ballYL - 1, 1, 99);
  state.toGo += 1;
  state.down = (state.down + 1) as 1 | 2 | 3 | 4;
  advanceClock(state, 40);
  accumulateDriveTime(state, 40, -1);
  yield event(state, "kneel", `${offTeam.abbr} take a knee.`, false);
}

function* spikePlay(
  state: InternalState,
  off: ReturnType<typeof teamSimRatings>,
  offTeam: { id: string; abbr: string; name: string },
  rng: RNG,
): Generator<LiveEvent, void, void> {
  state.drivePlays++;
  state.down = (state.down + 1) as 1 | 2 | 3 | 4;
  advanceClock(state, 3);
  accumulateDriveTime(state, 3, 0);
  yield event(state, "spike", `${offTeam.abbr} spike the ball to stop the clock.`, false);
}

// ========== Decision logic ==========

function decideFourthDown(state: InternalState, isHome: boolean): "punt" | "fg" | "go" {
  const fgDist = (100 - state.ballYL) + 17;
  const offScore = isHome ? state.homeScore : state.awayScore;
  const defScore = isHome ? state.awayScore : state.homeScore;
  const trailing = offScore < defScore;
  const lateAndTrailing = state.qtr === 4 && state.secLeft < 240 && trailing;
  const mods = offModsFor(state, state.possession);
  const agg = mods.fourthDownAgg; // 0..1

  // Late & trailing: aggressive coaches go further out
  if (lateAndTrailing) {
    const goRange = 4 + Math.round(agg * 4); // 4..8 yds
    if (state.toGo <= goRange) return "go";
  }

  // Make FG range a bit longer for aggressive coaches (they trust their leg, but Lions etc. also go)
  const fgRange = 50 + Math.round(agg * 8);
  if (fgDist <= fgRange) {
    // Aggressive coaches sometimes still go for it on 4th & short in plus territory rather than kick
    if (state.toGo <= 2 && state.ballYL >= 60 && Math.random() < agg * 0.7) return "go";
    return "fg";
  }

  // 4th & short anywhere past midfield: aggression-driven
  if (state.toGo <= 1 && state.ballYL >= 45) {
    return Math.random() < agg * 0.85 ? "go" : "punt";
  }
  if (state.toGo <= 2 && state.ballYL >= 55) {
    return Math.random() < agg * 0.55 ? "go" : "punt";
  }
  // Aggressive 4th & 1 from own territory (rare)
  if (state.toGo <= 1 && state.ballYL >= 35 && Math.random() < agg * 0.25) return "go";
  return "punt";
}

function shouldKneel(state: InternalState, isHome: boolean): boolean {
  if (state.qtr !== 4) return false;
  const offScore = isHome ? state.homeScore : state.awayScore;
  const defScore = isHome ? state.awayScore : state.homeScore;
  if (offScore <= defScore) return false;
  if (state.secLeft > 90) return false;
  return true;
}

function shouldSpike(state: InternalState): boolean {
  if (state.qtr !== 2 && state.qtr !== 4) return false;
  if (state.secLeft > 25) return false;
  if (state.down >= 4) return false;
  return Math.random() < 0.3;
}

// ========== Helpers ==========

function event(
  state: InternalState,
  kind: LiveEventKind,
  description: string,
  bigPlay: boolean,
  scoreChange?: { home: number; away: number },
): LiveEvent {
  // Snapshot state (shallow clone of public fields)
  const snap: LiveGameState = {
    qtr: state.qtr,
    secLeft: Math.max(0, state.secLeft),
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    possession: state.possession,
    ballYL: state.ballYL,
    down: state.down,
    toGo: state.toGo,
    driveStartYL: state.driveStartYL,
    drivePlays: state.drivePlays,
    homeTimeouts: state.homeTimeouts,
    awayTimeouts: state.awayTimeouts,
    driveLog: state.driveLog,
    homeBox: state.homeBox,
    awayBox: state.awayBox,
    homeYards: state.homeYards,
    awayYards: state.awayYards,
    homeTOP: state.homeTOP,
    awayTOP: state.awayTOP,
    homeTO: state.homeTO,
    awayTO: state.awayTO,
  };
  return { kind, description, bigPlay, state: snap, scoreChange };
}

function getBox(state: InternalState, isHome: boolean, playerId: string): BoxStat {
  const arr = isHome ? state.homeBox : state.awayBox;
  let s = arr.find((b) => b.playerId === playerId);
  if (!s) {
    s = { playerId };
    arr.push(s);
  }
  return s;
}

function addOffYards(state: InternalState, yds: number) {
  if (isPossHome(state)) state.homeYards += Math.max(0, yds);
  else state.awayYards += Math.max(0, yds);
  state.driveYards += yds;
}

function isPossHome(state: InternalState): boolean {
  return state.possession === state.homeTeamId;
}

function advanceClock(state: InternalState, sec: number) {
  state.secLeft = Math.max(0, state.secLeft - sec);
}

function accumulateDriveTime(state: InternalState, sec: number, _yds: number) {
  state.driveTime += sec;
  if (isPossHome(state)) state.homeTOP += sec; else state.awayTOP += sec;
}

function flushDrive(state: InternalState, result: DriveLog["result"], scorerId?: string) {
  if (state.drivePlays === 0 && state.driveTime === 0) return;
  state.driveLog.push({
    team: state.driveStartPossession,
    startYL: state.driveStartYL,
    result,
    plays: state.drivePlays,
    yards: state.driveYards,
    timeSec: state.driveTime,
    text: `${TEAMS_BY_ID[state.driveStartPossession]?.abbr ?? state.driveStartPossession} drive: ${state.drivePlays}p, ${state.driveYards}y → ${result}`,
    scorerId,
  });
}

function lookupName(state: InternalState, playerId: string): string {
  const p = state.league.players[playerId];
  if (!p) return playerId;
  return `${p.firstName[0]}. ${p.lastName}`;
}

function pickTop(box: BoxStat[]): string[] {
  const score = (b: BoxStat) =>
    (b.passYds ?? 0) * 0.04 + (b.passTd ?? 0) * 6 +
    (b.rushYds ?? 0) * 0.1 + (b.rushTd ?? 0) * 6 +
    (b.recYds ?? 0) * 0.1 + (b.recTd ?? 0) * 6 +
    (b.tackles ?? 0) * 0.7 + (b.sacks ?? 0) * 4 + (b.ints ?? 0) * 5 + (b.ffum ?? 0) * 3;
  return [...box].sort((a, b) => score(b) - score(a)).slice(0, 3).map((b) => b.playerId);
}

function storyline(home: { city: string; name: string }, away: { city: string; name: string }, hs: number, as: number, ot: boolean): string {
  const margin = Math.abs(hs - as);
  const winner = hs > as ? home : away;
  const loser = hs > as ? away : home;
  if (hs === as) return `${home.name} and ${away.name} play to a ${hs}–${as} draw.`;
  if (ot) return `${winner.name} edge ${loser.name} ${Math.max(hs, as)}–${Math.min(hs, as)} in overtime.`;
  if (margin >= 24) return `${winner.name} demolish ${loser.name} ${Math.max(hs, as)}–${Math.min(hs, as)}.`;
  if (margin <= 3) return `${winner.name} hold off ${loser.name} ${Math.max(hs, as)}–${Math.min(hs, as)} in a nail-biter.`;
  return `${winner.name} beat ${loser.name} ${Math.max(hs, as)}–${Math.min(hs, as)}.`;
}

// Re-export so the live UI can resolve names via league.players
export function nameOf(league: League, playerId: string): string {
  const p = league.players[playerId];
  if (!p) return playerId;
  return `${p.firstName[0]}. ${p.lastName}`;
}
