import { RNG } from "@/lib/rng";
import type { Contract, League, Player } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { computeMarketValue } from "@/lib/gen/player";
import { personalityFor } from "./personalities";
import { computeTeamPhase } from "./strategy";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";
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
 * Restructure converts most of this year's AAV into prorated bonus.
 *
 * Total cap commitment is unchanged — money is shifted, not erased. We
 * implement this by leaving `aav` alone (so trades transfer cleanly) and
 * pushing two adjustments into `league.deadCap`:
 *   - Year 1: NEGATIVE entry (-capRelief) → reduces this season's hit
 *   - Years 2..N: POSITIVE entries (+proratedPerYear) → the hangover
 *
 * Net delta: -capRelief + (years-1) * proratedPerYear ≈ 0
 *
 * Side effect: signingBonus + guaranteedYears bump so a future cut hurts
 * (mirrors real NFL — restructures lock you in).
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

  // Convert ~70% of one year's AAV into prorated bonus over the remaining contract.
  const convert = Math.round(c.aav * 0.70 * 10) / 10;
  const proratedPerYear = Math.round((convert / c.years) * 10) / 10;
  // Year-1 cap saving = convert minus the year-1 share of the proration
  const capRelief = Math.round((convert - proratedPerYear) * 10) / 10;

  // Bonus / guarantee tracking — affects a future cut's dead cap charge
  c.signingBonus = (c.signingBonus ?? 0) + convert;
  c.guaranteedYears = Math.max(c.guaranteedYears ?? 0, 1);

  // Push the cap shifts into deadCap. AAV stays untouched.
  if (!league.deadCap[p.team]) league.deadCap[p.team] = [];
  // Year-1 relief (negative entry — shows as cap savings)
  league.deadCap[p.team].push({
    teamId: p.team,
    year: league.year,
    amount: -capRelief,
    playerName: `${p.firstName} ${p.lastName} (restructure relief)`,
  });
  // Future-year hangover (positive entries spread across remaining years)
  const futureHits: { year: number; amount: number }[] = [];
  for (let i = 1; i < c.years; i++) {
    league.deadCap[p.team].push({
      teamId: p.team,
      year: league.year + i,
      amount: proratedPerYear,
      playerName: `${p.firstName} ${p.lastName} (restructure proration)`,
    });
    futureHits.push({ year: league.year + i, amount: proratedPerYear });
  }

  league.news.unshift({
    id: `restruct${p.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "FA",
    headline: `${TEAMS_BY_ID[p.team].abbr} restructure ${p.firstName} ${p.lastName}'s deal — $${capRelief.toFixed(1)}M cap relief now, +$${proratedPerYear.toFixed(1)}M / yr through ${league.year + c.years - 1}`,
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
  // Validate cap (currentTeamPayroll already includes dead cap for this year)
  const capUsed = currentTeamPayroll(league, team.id);
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

/** Suggested extension AAV — used by user UI. */
export function suggestedExtensionAav(player: Player): number {
  return Math.round(computeMarketValue(player.position, player.ovr, player.age) * 1.05 * 10) / 10;
}
