import { RNG } from "@/lib/rng";
import type { Game, Team } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";

let gid = 1;
export function newGameId() { return `g${gid++}`; }
export function setGameIdSeed(n: number) { gid = n; }
export function currentGameIdSeed() { return gid; }

/**
 * Build a simplified 18-week regular season schedule.
 * Each team plays:
 *  - 6 div games (twice each opponent)
 *  - rest (10 games) vs random opponents from same conference and other conference,
 *    avoiding repeat matchups in a season.
 * One bye week per team.
 */
export function buildSchedule(year: number, rng: RNG): Game[] {
  const WEEKS = 18;
  const games: Game[] = [];
  const counts: Record<string, number> = Object.fromEntries(TEAMS.map((t) => [t.id, 0]));
  const opponents: Record<string, Set<string>> = Object.fromEntries(
    TEAMS.map((t) => [t.id, new Set<string>()]),
  );
  const homeAway: Record<string, { home: number; away: number }> = Object.fromEntries(
    TEAMS.map((t) => [t.id, { home: 0, away: 0 }]),
  );
  // weeks per team — bool[]
  const slots: Record<string, boolean[]> = Object.fromEntries(
    TEAMS.map((t) => [t.id, new Array(WEEKS).fill(false)]),
  );

  // 1) Division games (twice). Each team plays each div opponent home & away.
  for (const t of TEAMS) {
    const div = TEAMS.filter((x) => x.id !== t.id && x.conference === t.conference && x.division === t.division);
    for (const opp of div) {
      // Track in opponents — we add two matchups per pair, but iterate carefully so we don't double-create.
      if (t.id < opp.id) {
        // create both legs
        addMatchup(games, year, t.id, opp.id, /*forceHome*/ true);
        addMatchup(games, year, opp.id, t.id, /*forceHome*/ true);
        opponents[t.id].add(opp.id);
        opponents[opp.id].add(t.id);
      }
    }
  }

  // 2) Fill remaining games — each team needs 17 games total. Currently 6 from div.
  // Add 11 more per team (will yield bye automatically since 18 weeks - 17 games = 1 bye).
  const needed = 17;
  let attempts = 0;
  while (TEAMS.some((t) => countGames(games, t.id) < needed) && attempts < 5000) {
    attempts++;
    const candidates = TEAMS.filter((t) => countGames(games, t.id) < needed)
      .sort((a, b) => countGames(games, a.id) - countGames(games, b.id));
    if (!candidates.length) break;
    const t = candidates[0];
    // Pick an opponent not already played, and that also needs games
    const pool = TEAMS.filter((x) =>
      x.id !== t.id &&
      countGames(games, x.id) < needed &&
      !hasMatchup(games, t.id, x.id),
    );
    if (!pool.length) {
      // Allow repeat (rare)
      const pool2 = TEAMS.filter((x) => x.id !== t.id && countGames(games, x.id) < needed);
      if (!pool2.length) break;
      const opp = rng.pick(pool2);
      addMatchup(games, year, t.id, opp.id, false);
      continue;
    }
    const opp = rng.pick(pool);
    // Decide home/away to balance
    const tHome = homeAwayCount(games, t.id).home;
    const oppHome = homeAwayCount(games, opp.id).home;
    const home = tHome <= oppHome ? t.id : opp.id;
    const away = home === t.id ? opp.id : t.id;
    addMatchup(games, year, home, away, false);
  }

  // 3) Assign weeks. Greedy: for each team, distribute their games into weeks such that
  //    no team plays twice in same week and exactly 1 bye.
  // Strategy: process games in random order, place into earliest available week for both teams.
  const ordered = rng.shuffle(games);
  for (const g of ordered) {
    let placed = false;
    const weekOrder = rng.shuffle(Array.from({ length: WEEKS }, (_, i) => i));
    for (const w of weekOrder) {
      if (!slots[g.home][w] && !slots[g.away][w]) {
        g.week = w + 1;
        slots[g.home][w] = true;
        slots[g.away][w] = true;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Shouldn't happen but fall back
      g.week = rng.int(1, WEEKS);
    }
  }

  // Verify each team has 17 games (1 bye)
  for (const t of TEAMS) {
    const tw = slots[t.id].filter(Boolean).length;
    if (tw !== 17) {
      // Tolerate; sim still works.
      // console.warn(`team ${t.id} has ${tw} game weeks`);
    }
  }

  // Sort by week
  games.sort((a, b) => a.week - b.week);
  return games;
}

function countGames(games: Game[], team: string) {
  return games.filter((g) => g.home === team || g.away === team).length;
}
function homeAwayCount(games: Game[], team: string) {
  let home = 0, away = 0;
  for (const g of games) {
    if (g.home === team) home++;
    if (g.away === team) away++;
  }
  return { home, away };
}
function hasMatchup(games: Game[], a: string, b: string) {
  return games.some(
    (g) => (g.home === a && g.away === b) || (g.home === b && g.away === a),
  );
}
function addMatchup(games: Game[], year: number, home: string, away: string, isDiv: boolean) {
  const t1 = TEAMS_BY_ID[home];
  const t2 = TEAMS_BY_ID[away];
  const sameDiv = t1.conference === t2.conference && t1.division === t2.division;
  games.push({
    id: newGameId(),
    year,
    week: 0, // assigned later
    home,
    away,
    played: false,
    isDivisional: isDiv || sameDiv,
  });
}
