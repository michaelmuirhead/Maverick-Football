import type { Game, League, StandingsRow } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { computePlayoffSeeds, simulateWeek as simulateRegularWeek, applyResult, addGameStatsToPlayers } from "./season";
import { simulateGame } from "./engine";
import { newGameId } from "@/lib/gen/schedule";

/** Build playoff bracket games for the current year and append to schedule. */
export function buildPlayoffBracket(league: League) {
  const afc = computePlayoffSeeds(league, "AFC");
  const nfc = computePlayoffSeeds(league, "NFC");

  // Wild Card round (week 19)
  const week = 19;
  const games: Game[] = [];

  // Seeds: 1 has bye. 2 vs 7, 3 vs 6, 4 vs 5
  for (const conf of [afc, nfc]) {
    const matchups = [
      { home: conf[1], away: conf[6] },
      { home: conf[2], away: conf[5] },
      { home: conf[3], away: conf[4] },
    ];
    for (const m of matchups) {
      games.push({
        id: newGameId(),
        year: league.year,
        week,
        home: m.home.team,
        away: m.away.team,
        played: false,
        playoffRound: "WC",
        conference: TEAMS_BY_ID[m.home.team].conference,
      });
    }
  }
  league.schedule.push(...games);
}

export function advancePlayoffsAfterWeek(league: League, justFinishedWeek: number) {
  const conf: ("AFC" | "NFC")[] = ["AFC","NFC"];

  if (justFinishedWeek === 19) {
    // After WC, build divisional. 1 seed plays lowest remaining seed; other two play.
    const seedsByConf = { AFC: computePlayoffSeeds(league, "AFC"), NFC: computePlayoffSeeds(league, "NFC") };
    for (const c of conf) {
      const wcGames = league.schedule.filter((g) => g.year === league.year && g.week === 19 && g.conference === c && g.played);
      const winners = wcGames.map((g) => (g.result!.homeScore > g.result!.awayScore ? g.home : g.away));
      const remaining = [seedsByConf[c][0].team, ...winners];
      const ranked = remaining.sort((a, b) => seedRank(seedsByConf[c], a) - seedRank(seedsByConf[c], b));
      const top = ranked[0];
      const others = ranked.slice(1);
      // 1 vs lowest, then middle two
      const m1 = { home: top, away: others[2] };
      const m2 = { home: others[0], away: others[1] };
      for (const m of [m1, m2]) {
        league.schedule.push({
          id: newGameId(),
          year: league.year, week: 20,
          home: m.home, away: m.away,
          played: false, playoffRound: "DIV",
          conference: c,
        });
      }
    }
    return;
  }

  if (justFinishedWeek === 20) {
    // Conference Championships
    const seedsByConf = { AFC: computePlayoffSeeds(league, "AFC"), NFC: computePlayoffSeeds(league, "NFC") };
    for (const c of conf) {
      const divGames = league.schedule.filter((g) => g.year === league.year && g.week === 20 && g.conference === c && g.played);
      const winners = divGames.map((g) => (g.result!.homeScore > g.result!.awayScore ? g.home : g.away));
      // higher seed hosts
      const ranked = winners.sort((a, b) => seedRank(seedsByConf[c], a) - seedRank(seedsByConf[c], b));
      league.schedule.push({
        id: newGameId(),
        year: league.year, week: 21,
        home: ranked[0], away: ranked[1],
        played: false, playoffRound: "CONF",
        conference: c,
      });
    }
    return;
  }

  if (justFinishedWeek === 21) {
    // Super Bowl — winners of each conference championship
    const cgs = league.schedule.filter((g) => g.year === league.year && g.week === 21 && g.played);
    const afcW = cgs.find((g) => g.conference === "AFC")!;
    const nfcW = cgs.find((g) => g.conference === "NFC")!;
    const afcChamp = afcW.result!.homeScore > afcW.result!.awayScore ? afcW.home : afcW.away;
    const nfcChamp = nfcW.result!.homeScore > nfcW.result!.awayScore ? nfcW.home : nfcW.away;
    league.schedule.push({
      id: newGameId(),
      year: league.year, week: 22,
      home: afcChamp, away: nfcChamp,
      played: false, playoffRound: "SB",
    });
    return;
  }

  if (justFinishedWeek === 22) {
    // Super Bowl played; record champion
    const sb = league.schedule.find((g) => g.year === league.year && g.week === 22 && g.played);
    if (sb) {
      const champ = sb.result!.homeScore > sb.result!.awayScore ? sb.home : sb.away;
      const ru = champ === sb.home ? sb.away : sb.home;
      league.champions.push({ year: league.year, team: champ, runnerUp: ru });
      league.history.push({ year: league.year, champion: champ, runnerUp: ru });
      league.news.unshift({
        id: `champ${league.year}`,
        year: league.year, week: 22, ts: Date.now(),
        category: "League",
        headline: `${TEAMS_BY_ID[champ].city} ${TEAMS_BY_ID[champ].name} win Super Bowl ${romanize(league.year - league.founded + 1)} over ${TEAMS_BY_ID[ru].city} ${TEAMS_BY_ID[ru].name}`,
      });
    }
    return;
  }
}

function seedRank(seeds: StandingsRow[], teamId: string) {
  const r = seeds.find((s) => s.team === teamId);
  return r?.seed ?? 99;
}

function romanize(n: number): string {
  const numerals: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [v, s] of numerals) {
    while (n >= v) { result += s; n -= v; }
  }
  return result;
}
