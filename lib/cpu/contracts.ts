import { RNG } from "@/lib/rng";
import type { Contract, League, Player } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { computeMarketValue } from "@/lib/gen/player";
import { personalityFor } from "./personalities";
import { computeTeamPhase } from "./strategy";
import { clamp } from "@/lib/utils";

// =====================================================================
// Cap depth: restructures, extensions, cuts with dead cap, holdouts.
// =====================================================================

export interface ExtendOptions {
  addYears: number;          // years tacked on
  newAav: number;            // new AAV across the extension
  guaranteedYears?: number;
}

export interface RestructureResult {
  ok: boolean;
  reason?: string;
  capRelief: number;         // immediate cap saved
  futureHits: { year: number; amount: number }[];
}

/**
 * Restructure converts most of this year's AAV into prorated bonus over
 * the remaining years. Saves cap now; pushes dead cap into the future.
 */
export function restructureContract(
  league: League, playerId: string,
): RestructureResult {
  const p = league.players[playerId];
  if (!p || !p.contract || !p.team) {
    return { ok: false, reason: "Player not under contract", capRelief: 0, futureHits: [] };
  }
  const c = p.contract;
  if (c.years < 2) return { ok: false, reason: "Need 2+ years remaining", capRelief: 0, futureHits: [] };
  // Convert ~70% of this year's AAV into bonus prorated
  const convert = Math.round(c.aav * 0.70 * 10) / 10;
  const proratedPerYear = Math.round((convert / c.years) * 10) / 10;
  c.aav = Math.round((c.aav - convert + proratedPerYear) * 10) / 10;
  c.signingBonus = (c.signingBonus ?? 0) + convert;
  c.guaranteedYears = Math.max(c.guaranteedYears ?? 0, 1);
  const capRelief = Math.round((convert - proratedPerYear) * 10) / 10;
  const futureHits: { year: number; amount: number }[] = [];
  for (let i = 1; i < c.years; i++) {
    futureHits.push({ year: league.year + i, amount: proratedPerYear });
  }
  league.news.unshift({
    id: `restruct${p.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "FA",
    headline: `${TEAMS_BY_ID[p.team].abbr} restructure ${p.firstName} ${p.lastName}'s deal — $${capRelief.toFixed(1)}M cap relief`,
    teamId: p.team, playerId: p.id,
  });
  return { ok: true, capRelief, futureHits };
}

/** Extend an existing contract: tacks on years at a new (typically higher) AAV. */
export function extendContract(
  league: League, playerId: string, opts: ExtendOptions,
): { ok: boolean; reason?: string } {
  const p = league.players[playerId];
  if (!p || !p.contract || !p.team) return { ok: false, reason: "No active contract" };
  const team = TEAMS_BY_ID[p.team];
  // Validate cap
  const capUsed = currentTeamPayrollLite(league, team.id);
  const capDelta = opts.newAav - p.contract.aav;
  if (capUsed + capDelta > team.cap) {
    return { ok: false, reason: "Not enough cap room" };
  }
  // Update contract
  p.contract.years += opts.addYears;
  p.contract.aav = Math.round(opts.newAav * 10) / 10;
  p.contract.signingBonus = (p.contract.signingBonus ?? 0) + opts.newAav * 0.4;
  p.contract.guaranteedYears = opts.guaranteedYears ?? Math.min(p.contract.years, 2);
  // Resolve any holdout
  p.holdoutWeeks = 0;
  p.demandsExtension = false;
  league.news.unshift({
    id: `ext${p.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "FA",
    headline: `${team.abbr} extend ${p.firstName} ${p.lastName} — ${opts.addYears}yr / $${opts.newAav.toFixed(1)}M AAV`,
    teamId: team.id, playerId: p.id,
  });
  return { ok: true };
}

/** Cut a player. They become a free agent; team eats dead cap on guaranteed years. */
export function cutPlayer(
  league: League, playerId: string, opts: { postJune1?: boolean } = {},
): { ok: boolean; reason?: string; deadCapThisYear: number; deadCapNextYear: number } {
  const p = league.players[playerId];
  if (!p || !p.team) return { ok: false, reason: "No team", deadCapThisYear: 0, deadCapNextYear: 0 };
  const team = TEAMS_BY_ID[p.team];
  const c = p.contract;
  let deadCapThisYear = 0;
  let deadCapNextYear = 0;
  if (c) {
    const remainingBonus = c.signingBonus ?? 0;
    const remainingGuaranteedAav = (c.guaranteedYears ?? 0) > 0 ? c.aav : 0;
    if (opts.postJune1) {
      deadCapThisYear = remainingGuaranteedAav;
      deadCapNextYear = remainingBonus;
    } else {
      deadCapThisYear = remainingBonus + remainingGuaranteedAav;
    }
  }
  // Record dead cap entries
  if (deadCapThisYear > 0) {
    if (!league.deadCap[team.id]) league.deadCap[team.id] = [];
    league.deadCap[team.id].push({
      teamId: team.id, year: league.year,
      amount: Math.round(deadCapThisYear * 10) / 10,
      playerName: `${p.firstName} ${p.lastName}`,
    });
  }
  if (deadCapNextYear > 0) {
    if (!league.deadCap[team.id]) league.deadCap[team.id] = [];
    league.deadCap[team.id].push({
      teamId: team.id, year: league.year + 1,
      amount: Math.round(deadCapNextYear * 10) / 10,
      playerName: `${p.firstName} ${p.lastName}`,
    });
  }
  p.team = null;
  p.contract = null;
  p.depth = "Reserve";
  p.holdoutWeeks = 0;
  p.demandsExtension = false;
  p.onIR = false;
  p.onPracticeSquad = false;
  league.news.unshift({
    id: `cut${p.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "FA",
    headline: `${team.abbr} release ${p.firstName} ${p.lastName} (${p.position})${deadCapThisYear > 0 ? ` — $${deadCapThisYear.toFixed(1)}M dead cap` : ""}`,
    teamId: team.id, playerId: p.id,
  });
  return { ok: true, deadCapThisYear, deadCapNextYear };
}

/** Identify players who deserve extensions and may hold out if the team doesn't extend. */
export function rollHoldouts(league: League) {
  const rng = new RNG(`hold:${league.year}`);
  for (const p of Object.values(league.players)) {
    if (p.retired || !p.team || !p.contract) continue;
    if (p.contract.years > 2) continue;          // only entering walk year (or 2nd-to-last)
    if (p.ovr < 80) continue;                    // only good players have leverage
    const market = computeMarketValue(p.position, p.ovr, p.age);
    const underpaid = market - p.contract.aav;
    if (underpaid >= 4 && rng.chance(0.45)) {
      p.demandsExtension = true;
      league.news.unshift({
        id: `hold${p.id}-${league.year}`,
        year: league.year, week: 0, ts: Date.now(),
        category: "FA",
        headline: `${p.firstName} ${p.lastName} (${p.position}) wants a new deal — market value $${market.toFixed(1)}M`,
        teamId: p.team, playerId: p.id,
      });
    }
  }
}

/** Apply small in-season effect: a player demanding an extension misses some practice. */
export function holdoutAttributeImpact(player: Player): number {
  // Returns small OVR penalty that only applies if extension is unresolved.
  if (player.demandsExtension && (player.holdoutWeeks ?? 0) > 0) return -3;
  if (player.demandsExtension) return -1;        // still distracted
  return 0;
}

export function currentTeamPayrollLite(league: League, teamId: string): number {
  let total = 0;
  for (const p of Object.values(league.players)) {
    if (p.team === teamId && p.contract) total += p.contract.aav;
  }
  // Add dead cap for this year
  const dead = (league.deadCap[teamId] ?? []).filter((d) => d.year === league.year).reduce((s, d) => s + d.amount, 0);
  return total + dead;
}

/** Suggested extension AAV — used by user UI. */
export function suggestedExtensionAav(player: Player): number {
  return Math.round(computeMarketValue(player.position, player.ovr, player.age) * 1.05 * 10) / 10;
}
