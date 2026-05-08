import type { BrandingOverride, League, StadiumState, Team } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";

// =====================================================================
// Owner-mode flair: stadium upgrades + custom branding overrides.
// =====================================================================

export const STADIUM_UPGRADE_COST = 8;          // $M of cap charge added next year
export const STADIUM_UPGRADE_MAX = 5;            // max HFA bumps total

export function ensureStadiumState(league: League, teamId: string): StadiumState {
  league.stadiumStates = league.stadiumStates ?? {};
  if (!league.stadiumStates[teamId]) {
    league.stadiumStates[teamId] = {
      team: teamId,
      hfa: TEAMS_BY_ID[teamId].hfa ?? 0,
    };
  }
  return league.stadiumStates[teamId];
}

export function effectiveHfa(league: League, teamId: string): number {
  const s = league.stadiumStates?.[teamId];
  return s?.hfa ?? TEAMS_BY_ID[teamId].hfa ?? 0;
}

/** Owner-mode action: upgrade the stadium. Costs cap as a dead-cap entry next year. */
export function upgradeStadium(league: League, teamId: string): { ok: boolean; reason?: string } {
  const s = ensureStadiumState(league, teamId);
  if (s.hfa >= STADIUM_UPGRADE_MAX) return { ok: false, reason: "Stadium already max upgraded" };
  s.hfa += 1;
  s.upgradeYear = league.year;
  // Add a dead cap charge next year representing the spending
  if (!league.deadCap[teamId]) league.deadCap[teamId] = [];
  league.deadCap[teamId].push({
    teamId, year: league.year + 1, amount: STADIUM_UPGRADE_COST, playerName: `Stadium upgrade`,
  });
  league.news.unshift({
    id: `stadium-${teamId}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `${TEAMS_BY_ID[teamId].name} announce stadium upgrade — HFA now ${s.hfa}`,
    teamId,
  });
  return { ok: true };
}

// ---------------- Branding overrides ----------------

export function ensureBrandingBucket(league: League) {
  league.brandingOverrides = league.brandingOverrides ?? {};
}

/** Resolve a team's effective display info (overrides win over base). */
export function resolveTeam(league: League, teamId: string): Team {
  const base = TEAMS_BY_ID[teamId];
  const ov = league.brandingOverrides?.[teamId];
  if (!ov) return base;
  return {
    ...base,
    city: ov.city ?? base.city,
    name: ov.name ?? base.name,
    primary: ov.primary ?? base.primary,
    secondary: ov.secondary ?? base.secondary,
    stadium: ov.stadium ?? base.stadium,
  };
}

export function setBranding(league: League, teamId: string, override: Partial<BrandingOverride>) {
  ensureBrandingBucket(league);
  const existing = league.brandingOverrides[teamId] ?? { team: teamId };
  league.brandingOverrides[teamId] = {
    ...existing,
    team: teamId,
    ...override,
  };
}
