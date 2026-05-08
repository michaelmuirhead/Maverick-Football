import type { FinancesEntry, League, TeamFinances } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";

// =====================================================================
// Owner finances. Annual revenue / expense tracker per team. Surfaced
// in the Owner-mode finances page.
// =====================================================================

const TICKET_REVENUE_BASE = 80;        // $M per year (average)
const JERSEY_BASE = 12;
const TV_DEAL_PER_TEAM = 350;          // huge equal-share TV deal
const SPONSOR_BASE = 45;

const STAFF_COST_BASE = 35;            // coaches, scouting, ops staff
const FACILITIES_COST_BASE = 28;       // stadium ops, equipment, travel

export function ensureFinances(league: League, teamId: string): TeamFinances {
  league.finances = league.finances ?? {};
  if (!league.finances[teamId]) {
    league.finances[teamId] = {
      teamId,
      totalProfit: 0,
      history: [],
    };
  }
  return league.finances[teamId];
}

export function ensureAllFinances(league: League) {
  for (const t of TEAMS) ensureFinances(league, t.id);
}

/**
 * Compute and store one season's finances for a team.
 * Should be called once per offseason after the season ends.
 */
export function recordSeasonFinances(league: League, teamId: string) {
  const team = TEAMS_BY_ID[teamId];
  if (!team) return;
  const fin = ensureFinances(league, teamId);
  // Already recorded?
  if (fin.history.some((h) => h.year === league.year)) return;

  const standing = league.standings[teamId];
  const winRate = (standing.w + standing.t * 0.5) / Math.max(standing.w + standing.l + standing.t, 1);
  const wonChamp = league.champions.some((c) => c.year === league.year && c.team === teamId);
  const madePlayoffs = league.schedule.some(
    (g) => g.year === league.year && g.week === 19 && g.played &&
           (g.home === teamId || g.away === teamId),
  );
  const inflation = league.capInflation ?? 1;

  // Revenue scales with winning + base * inflation
  const ticketRevenue = Math.round(TICKET_REVENUE_BASE * inflation * (0.85 + winRate * 0.4));
  const jerseyRevenue = Math.round(JERSEY_BASE * inflation * (0.6 + winRate * 1.2 + (wonChamp ? 0.5 : 0)));
  const tvDealRevenue = Math.round(TV_DEAL_PER_TEAM * inflation);
  const sponsorRevenue = Math.round(SPONSOR_BASE * inflation * (0.8 + (madePlayoffs ? 0.35 : 0) + (wonChamp ? 0.25 : 0)));

  // Expenses
  const payrollExpense = Math.round(currentTeamPayroll(league, teamId));
  const staffExpense = Math.round(STAFF_COST_BASE * inflation);
  const facilitiesExpense = Math.round(FACILITIES_COST_BASE * inflation);

  const net = ticketRevenue + jerseyRevenue + tvDealRevenue + sponsorRevenue
            - payrollExpense - staffExpense - facilitiesExpense;

  const entry: FinancesEntry = {
    year: league.year,
    ticketRevenue, jerseyRevenue, tvDealRevenue, sponsorRevenue,
    payrollExpense, staffExpense, facilitiesExpense,
    net,
  };
  fin.history.push(entry);
  fin.totalProfit += net;
}

export function recordAllSeasonFinances(league: League) {
  for (const t of TEAMS) recordSeasonFinances(league, t.id);
}

export function lifetimeProfit(league: League, teamId: string): number {
  return league.finances?.[teamId]?.totalProfit ?? 0;
}

export function totalRevenue(entry: FinancesEntry): number {
  return entry.ticketRevenue + entry.jerseyRevenue + entry.tvDealRevenue + entry.sponsorRevenue;
}

export function totalExpense(entry: FinancesEntry): number {
  return entry.payrollExpense + entry.staffExpense + entry.facilitiesExpense;
}
