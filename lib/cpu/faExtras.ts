import { RNG } from "@/lib/rng";
import type {
  CompPickAward, FranchiseTag, League, Player, RfaTender, RfaTenderLevel,
} from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { computeMarketValue } from "@/lib/gen/player";
import { POSITION_GROUP } from "@/lib/data/positions";
import { clamp } from "@/lib/utils";

// =====================================================================
// FA extras: compensatory picks, franchise tags, restricted free agents.
// =====================================================================

// ---------------- Compensatory picks ----------------

/**
 * Award compensatory picks based on net FA losses.
 * Counts contracts signed AAV vs lost AAV per team during last offseason.
 */
export function awardCompPicks(league: League, faSignings: { teamId: string; aav: number; ovr: number }[], faLosses: { teamId: string; aav: number; ovr: number }[]): CompPickAward[] {
  const awarded: CompPickAward[] = [];
  for (const team of TEAMS) {
    const losses = faLosses.filter((l) => l.teamId === team.id);
    const signs = faSignings.filter((s) => s.teamId === team.id);
    const lostValue = losses.reduce((s, l) => s + l.aav, 0);
    const signedValue = signs.reduce((s, l) => s + l.aav, 0);
    const netLoss = lostValue - signedValue;
    if (netLoss < 5) continue;

    // Quality of biggest loss determines round
    const biggestLoss = losses.sort((a, b) => b.aav - a.aav)[0];
    let round = 7;
    if (biggestLoss.aav >= 18 || biggestLoss.ovr >= 88) round = 3;
    else if (biggestLoss.aav >= 12 || biggestLoss.ovr >= 82) round = 4;
    else if (biggestLoss.aav >= 8 || biggestLoss.ovr >= 78) round = 5;
    else if (biggestLoss.aav >= 5) round = 6;

    awarded.push({
      year: league.year + 1,
      team: team.id,
      round,
      rationale: `Net FA loss of $${netLoss.toFixed(1)}M / OVR ${biggestLoss.ovr}`,
    });
  }
  league.compPicks = league.compPicks ?? [];
  league.compPicks.push(...awarded);
  return awarded;
}

/** Inject comp picks into next year's draft order at end of each round. */
export function injectCompPicksIntoDraft(league: League, year: number) {
  const compPicks = (league.compPicks ?? []).filter((c) => c.year === year);
  if (compPicks.length === 0) return;
  for (const c of compPicks) {
    const existingInRound = league.draftPicks.filter((dp) => dp.year === year && dp.round === c.round).length;
    league.draftPicks.push({
      year, round: c.round, pick: existingInRound + 1,
      originalTeam: c.team, currentTeam: c.team,
      compensatory: true,
    });
  }
}

// ---------------- Franchise Tag ----------------

/** Compute franchise tag salary at top-5 average AAV for the player's position. */
export function computeTagSalary(league: League, player: Player): number {
  const sameRoster = Object.values(league.players).filter(
    (p) => p.position === player.position && p.team && p.contract && !p.retired,
  );
  const top5 = sameRoster
    .sort((a, b) => (b.contract!.aav) - (a.contract!.aav))
    .slice(0, 5);
  if (!top5.length) return computeMarketValue(player.position, player.ovr, player.age) * 1.2;
  const avg = top5.reduce((s, p) => s + p.contract!.aav, 0) / top5.length;
  return Math.max(Math.round(avg * 1.05 * 10) / 10, computeMarketValue(player.position, player.ovr, player.age));
}

/** Apply a franchise tag — convert player into 1-year deal at the tag salary. */
export function applyFranchiseTag(
  league: League, teamId: string, playerId: string,
): { ok: boolean; reason?: string; salary?: number } {
  const p = league.players[playerId];
  if (!p) return { ok: false, reason: "Player not found" };
  if (p.team !== teamId) return { ok: false, reason: "Not on this team" };
  if (!p.contract || p.contract.years > 1) return { ok: false, reason: "Player must be entering walk year" };
  // Each team gets 1 tag per year
  league.franchiseTags = league.franchiseTags ?? [];
  if (league.franchiseTags.some((t) => t.team === teamId && t.year === league.year)) {
    return { ok: false, reason: "Team already has a franchise tag this year" };
  }
  const salary = computeTagSalary(league, p);
  p.contract = {
    years: 1,
    aav: salary,
    signedYear: league.year,
    signingBonus: 0,
    guaranteedYears: 1,
  };
  p.demandsExtension = false;
  league.franchiseTags.push({ team: teamId, playerId, year: league.year, salary });
  league.news.unshift({
    id: `tag${p.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "FA",
    headline: `${TEAMS_BY_ID[teamId].abbr} franchise-tag ${p.firstName} ${p.lastName} (${p.position}) — 1yr / $${salary.toFixed(1)}M`,
    teamId, playerId,
  });
  return { ok: true, salary };
}

/** Players whose contract expires this offseason and could be tagged. */
export function tagEligiblePlayers(league: League, teamId: string): Player[] {
  return Object.values(league.players)
    .filter((p) => p.team === teamId && !p.retired && p.contract && p.contract.years === 1)
    .filter((p) => p.ovr >= 75) // only quality vets are tag-worthy
    .sort((a, b) => b.ovr - a.ovr);
}

// ---------------- Restricted Free Agents ----------------

const RFA_TENDER_VALUE: Record<RfaTenderLevel, number> = {
  "first": 6.5,                    // 1st round tender = ~$6.5M
  "second": 4.8,                   // 2nd round tender
  "original": 3.4,                 // original-round tender
  "right-of-first-refusal": 2.9,   // ROFR (no draft compensation)
};

const RFA_COMPENSATION: Record<RfaTenderLevel, number> = {
  "first": 1, "second": 2, "original": 0, "right-of-first-refusal": 0,
};

/** Players with 3 NFL years played become RFAs. We approximate as draftYear + 3 → walk year. */
export function rfaEligible(league: League, teamId: string): Player[] {
  return Object.values(league.players).filter(
    (p) => p.team === teamId && !p.retired && p.contract && p.contract.years === 1
      && league.year - p.draftYear === 3
      && p.ovr >= 70,
  );
}

export function tenderRfa(
  league: League, teamId: string, playerId: string, level: RfaTenderLevel,
): { ok: boolean; reason?: string } {
  const p = league.players[playerId];
  if (!p || p.team !== teamId) return { ok: false, reason: "Not on this team" };
  if (!rfaEligible(league, teamId).some((x) => x.id === playerId)) return { ok: false, reason: "Not RFA-eligible" };
  const salary = RFA_TENDER_VALUE[level];
  league.rfaTenders = league.rfaTenders ?? [];
  league.rfaTenders.push({ playerId, team: teamId, level, salary, year: league.year });
  // Keep player on team at tender salary for 1 year
  p.contract = { years: 1, aav: salary, signedYear: league.year, signingBonus: 0, guaranteedYears: 0 };
  league.news.unshift({
    id: `rfa${p.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "FA",
    headline: `${TEAMS_BY_ID[teamId].abbr} tender ${p.firstName} ${p.lastName} (${p.position}) — ${level} round (${RFA_COMPENSATION[level]} pick comp)`,
    teamId, playerId,
  });
  return { ok: true };
}
