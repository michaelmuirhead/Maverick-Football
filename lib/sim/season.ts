import type { Game, GameResult, League, Player, SeasonStatLine, StandingsRow } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { simulateGame } from "./engine";
import { RNG } from "@/lib/rng";
import { rollGameInjuries, tickInjuries } from "@/lib/cpu/injuries";
import { updateGameRecords, scanRecordChases } from "@/lib/cpu/records";
import { bumpChemistryFromGame } from "@/lib/cpu/chemistry";
import { rollWeather } from "@/lib/cpu/weather";
import { publishWeeklyMockDraftIfApplicable } from "@/lib/cpu/scouting";
import { pressAfterGame } from "@/lib/cpu/pressConf";

export function emptyStandings(): Record<string, StandingsRow> {
  const s: Record<string, StandingsRow> = {};
  for (const t of TEAMS) {
    s[t.id] = { team: t.id, w: 0, l: 0, t: 0, pf: 0, pa: 0, divW: 0, divL: 0, confW: 0, confL: 0, streak: "" };
  }
  return s;
}

/** Apply a game result to standings. */
export function applyResult(league: League, game: Game, result: GameResult) {
  const home = TEAMS_BY_ID[game.home];
  const away = TEAMS_BY_ID[game.away];
  const sH = league.standings[home.id];
  const sA = league.standings[away.id];

  sH.pf += result.homeScore;
  sH.pa += result.awayScore;
  sA.pf += result.awayScore;
  sA.pa += result.homeScore;

  const sameDiv = home.conference === away.conference && home.division === away.division;
  const sameConf = home.conference === away.conference;

  if (result.homeScore === result.awayScore) {
    sH.t++; sA.t++;
    bumpStreak(sH, "T");
    bumpStreak(sA, "T");
  } else if (result.homeScore > result.awayScore) {
    sH.w++; sA.l++;
    bumpStreak(sH, "W"); bumpStreak(sA, "L");
    if (sameDiv) { sH.divW++; sA.divL++; }
    if (sameConf) { sH.confW++; sA.confL++; }
  } else {
    sH.l++; sA.w++;
    bumpStreak(sH, "L"); bumpStreak(sA, "W");
    if (sameDiv) { sH.divL++; sA.divW++; }
    if (sameConf) { sH.confL++; sA.confW++; }
  }
}

function bumpStreak(s: StandingsRow, k: "W" | "L" | "T") {
  if (s.streak.startsWith(k)) {
    const n = parseInt(s.streak.slice(1) || "0") + 1;
    s.streak = `${k}${n}`;
  } else {
    s.streak = `${k}1`;
  }
}

/** Add per-game stats to player season history (creates current-year row if missing) */
export function addGameStatsToPlayers(league: League, game: Game, result: GameResult) {
  const allBox = [...result.homeBox, ...result.awayBox];
  for (const b of allBox) {
    const player = league.players[b.playerId];
    if (!player) continue;
    let row = player.history.find((h) => h.year === league.year && h.team === player.team);
    if (!row) {
      row = { year: league.year, team: player.team!, gp: 0 };
      player.history.push(row);
    }
    row.gp += 1;
    row.passYds = (row.passYds ?? 0) + (b.passYds ?? 0);
    row.passTd = (row.passTd ?? 0) + (b.passTd ?? 0);
    row.passInt = (row.passInt ?? 0) + (b.passInt ?? 0);
    row.passAtt = (row.passAtt ?? 0) + (b.passAtt ?? 0);
    row.passCmp = (row.passCmp ?? 0) + (b.passCmp ?? 0);
    row.rushYds = (row.rushYds ?? 0) + (b.rushYds ?? 0);
    row.rushTd = (row.rushTd ?? 0) + (b.rushTd ?? 0);
    row.rushAtt = (row.rushAtt ?? 0) + (b.rushAtt ?? 0);
    row.rec = (row.rec ?? 0) + (b.rec ?? 0);
    row.recYds = (row.recYds ?? 0) + (b.recYds ?? 0);
    row.recTd = (row.recTd ?? 0) + (b.recTd ?? 0);
    row.tgt = (row.tgt ?? 0) + (b.tgt ?? 0);
    row.tackles = (row.tackles ?? 0) + (b.tackles ?? 0);
    row.sacks = (row.sacks ?? 0) + (b.sacks ?? 0);
    row.ints = (row.ints ?? 0) + (b.ints ?? 0);
    row.ffum = (row.ffum ?? 0) + (b.ffum ?? 0);
    row.fgm = (row.fgm ?? 0) + (b.fgm ?? 0);
    row.fga = (row.fga ?? 0) + (b.fga ?? 0);
    row.xpm = (row.xpm ?? 0) + (b.xpm ?? 0);
    row.xpa = (row.xpa ?? 0) + (b.xpa ?? 0);
  }
}

/** Legacy export: forwards to the typed injury system. */
export function rollInjuries(league: League, game: Game) {
  rollGameInjuries(league, game);
}

/** Simulate every unplayed game in the given week */
export function simulateWeek(league: League): { played: Game[]; results: GameResult[] } {
  const week = league.week;
  const games = league.schedule.filter((g) => g.year === league.year && g.week === week && !g.played);
  const results: GameResult[] = [];

  for (const g of games) {
    rollWeather(league, g);
    const result = simulateGame(league, g, league.seed);
    g.result = result;
    g.played = true;
    applyResult(league, g, result);
    addGameStatsToPlayers(league, g, result);
    rollGameInjuries(league, g);
    updateGameRecords(league, g);
    bumpChemistryFromGame(league, g);
    pressAfterGame(league, g.id);
    results.push(result);
    league.news.unshift({
      id: `n${Date.now()}-${g.id}`,
      year: league.year,
      week,
      ts: Date.now(),
      category: "Game",
      headline: result.storyline,
      teamId: result.homeScore > result.awayScore ? g.home : g.away,
    });
  }

  // Tick injuries at end of week
  tickInjuries(league);
  // Mock draft on week 6+ (regular season)
  publishWeeklyMockDraftIfApplicable(league);
  // Record-chase scan
  scanRecordChases(league);
  return { played: games, results };
}

/** Sort standings by W%, head-to-head approx (skip), divW, confW, PF-PA */
export function sortStandingsTeams(rows: StandingsRow[]): StandingsRow[] {
  return [...rows].sort((a, b) => {
    const wp = (r: StandingsRow) => (r.w + r.t * 0.5) / Math.max(r.w + r.l + r.t, 1);
    const wpa = wp(a), wpb = wp(b);
    if (wpa !== wpb) return wpb - wpa;
    if (a.divW !== b.divW) return b.divW - a.divW;
    if (a.confW !== b.confW) return b.confW - a.confW;
    return (b.pf - b.pa) - (a.pf - a.pa);
  });
}

/** Determine playoff seeds within a conference (1-7). Top of each division get seeds 1-4, then 3 wildcards. */
export function computePlayoffSeeds(league: League, conf: "AFC" | "NFC"): StandingsRow[] {
  const teamsInConf = TEAMS.filter((t) => t.conference === conf);
  const rows = teamsInConf.map((t) => league.standings[t.id]);

  // Division winners
  const divs = ["East","North","South","West"] as const;
  const winners: StandingsRow[] = [];
  for (const d of divs) {
    const divTeams = teamsInConf.filter((t) => t.division === d);
    const sorted = sortStandingsTeams(divTeams.map((t) => league.standings[t.id]));
    winners.push(sorted[0]);
  }
  const sortedWinners = sortStandingsTeams(winners); // seeds 1-4

  // Wildcards: best 3 non-winners by W%
  const winnerIds = new Set(sortedWinners.map((r) => r.team));
  const others = rows.filter((r) => !winnerIds.has(r.team));
  const wildcards = sortStandingsTeams(others).slice(0, 3);

  const seeds = [...sortedWinners, ...wildcards].map((r, i) => ({ ...r, seed: i + 1 }));
  return seeds;
}
