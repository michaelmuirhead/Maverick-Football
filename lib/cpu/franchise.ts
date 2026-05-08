import type { FranchiseRecord, Game, League, Player } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { emptyFranchiseRecord } from "./records";

// =====================================================================
// Franchise-level Hall of Fame, retired numbers, rivalry head-to-head.
// =====================================================================

export function ensureFranchise(league: League, teamId: string): FranchiseRecord {
  if (!league.franchises[teamId]) league.franchises[teamId] = emptyFranchiseRecord(teamId);
  return league.franchises[teamId];
}

export function ensureAllFranchises(league: League) {
  for (const t of TEAMS) ensureFranchise(league, t.id);
}

/** Compute the team that the player spent the most career years with. */
function primaryTeam(player: Player): string | null {
  const counts: Record<string, number> = {};
  for (const h of player.history) counts[h.team] = (counts[h.team] ?? 0) + 1;
  let best: string | null = null;
  let bestN = 0;
  for (const [team, n] of Object.entries(counts)) {
    if (n > bestN) { best = team; bestN = n; }
  }
  return best;
}

/** Each offseason, induct elite retirees into their primary team's franchise HoF. */
export function inductFranchiseHoF(league: League) {
  for (const p of Object.values(league.players)) {
    if (!p.retired) continue;
    if (p.franchiseHofYear) continue; // already inducted
    const proBowls = p.history.filter((h) => h.proBowl).length;
    const allPros = p.history.filter((h) => h.allPro).length;
    const mvps = p.history.filter((h) => h.mvp).length;
    const score = proBowls + allPros * 3 + mvps * 6;
    if (score < 6) continue;
    const team = primaryTeam(p);
    if (!team) continue;
    const fr = ensureFranchise(league, team);
    if (fr.hof.includes(p.id)) continue;
    fr.hof.push(p.id);
    p.franchiseHofYear = league.year;
    league.news.unshift({
      id: `fhof${p.id}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "Award",
      headline: `${TEAMS_BY_ID[team].name} induct ${p.firstName} ${p.lastName} into franchise Hall of Fame`,
      teamId: team, playerId: p.id,
    });
  }
}

/** Retire a jersey number — done for elite franchise legends. */
export function retireJerseyNumbers(league: League) {
  for (const teamId of TEAMS.map((t) => t.id)) {
    const fr = ensureFranchise(league, teamId);
    // Eligible: retired, fHoF inducted, hadn't yet had number retired, and at least 5 PBs OR 1 MVP
    const candidates = fr.hof
      .map((id) => league.players[id])
      .filter((p): p is Player => !!p)
      .filter((p) => !p.retiredJerseyTeam)
      .filter((p) => {
        const proBowls = p.history.filter((h) => h.proBowl).length;
        const mvps = p.history.filter((h) => h.mvp).length;
        return proBowls >= 5 || mvps >= 1;
      })
      .filter((p) => !fr.retiredNumbers.some((rn) => rn.jersey === p.jersey));
    for (const p of candidates) {
      fr.retiredNumbers.push({ jersey: p.jersey, playerId: p.id });
      p.retiredJerseyTeam = teamId;
      league.news.unshift({
        id: `rj${p.id}`,
        year: league.year, week: 0, ts: Date.now(),
        category: "Award",
        headline: `${TEAMS_BY_ID[teamId].name} retire #${p.jersey} in honor of ${p.firstName} ${p.lastName}`,
        teamId, playerId: p.id,
      });
    }
  }
}

// =====================================================================
// Rivalry head-to-head from schedule history.
// =====================================================================

export interface H2H {
  teamA: string;
  teamB: string;
  aWins: number;
  bWins: number;
  ties: number;
  startYear: number;
}

/** Compute all-time head-to-head record between two teams from played games. */
export function headToHead(league: League, teamA: string, teamB: string): H2H {
  let aWins = 0, bWins = 0, ties = 0, startYear = league.founded;
  for (const g of league.schedule) {
    if (!g.played || !g.result) continue;
    const involves =
      (g.home === teamA && g.away === teamB) ||
      (g.home === teamB && g.away === teamA);
    if (!involves) continue;
    startYear = Math.min(startYear, g.year);
    const aIsHome = g.home === teamA;
    const aScore = aIsHome ? g.result.homeScore : g.result.awayScore;
    const bScore = aIsHome ? g.result.awayScore : g.result.homeScore;
    if (aScore > bScore) aWins++;
    else if (bScore > aScore) bWins++;
    else ties++;
  }
  return { teamA, teamB, aWins, bWins, ties, startYear };
}

export function rivalryLine(h: H2H): string {
  if (h.aWins === 0 && h.bWins === 0 && h.ties === 0) return "First meeting";
  if (h.aWins === h.bWins) return `Series tied ${h.aWins}-${h.bWins} since ${h.startYear}`;
  const leader = h.aWins > h.bWins ? h.teamA : h.teamB;
  const wins = Math.max(h.aWins, h.bWins);
  const losses = Math.min(h.aWins, h.bWins);
  const tiePart = h.ties > 0 ? `-${h.ties}` : "";
  return `${leader} leads ${wins}-${losses}${tiePart} since ${h.startYear}`;
}
