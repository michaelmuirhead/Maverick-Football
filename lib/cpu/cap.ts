import type { League, Team } from "@/lib/types";

// =====================================================================
// Effective salary cap with year-over-year inflation. Real NFL cap rises
// ~6.5% / yr; we apply the same compounding from league.founded.
// =====================================================================

export const CAP_INFLATION_PER_YEAR = 0.065;

/** Multiplier applied to base team.cap based on years elapsed. */
export function capInflationMultiplier(league: League): number {
  const years = Math.max(0, league.year - league.founded);
  return Math.pow(1 + CAP_INFLATION_PER_YEAR, years);
}

/** The current effective salary cap for a team. */
export function effectiveCap(league: League, team: Pick<Team, "cap">): number {
  const mult = league.capInflation ?? capInflationMultiplier(league);
  return Math.round(team.cap * mult * 10) / 10;
}

/** Bump the inflation multiplier by one year. Called from advanceOffseason. */
export function advanceCapInflation(league: League) {
  const next = (league.capInflation ?? 1) * (1 + CAP_INFLATION_PER_YEAR);
  league.capInflation = Math.round(next * 1000) / 1000;
}
