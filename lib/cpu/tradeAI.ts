import { RNG } from "@/lib/rng";
import type { League, Player, TradeAsset, TradeOffer } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { getRoster } from "@/lib/gen/roster";
import { POSITION_GROUP } from "@/lib/data/positions";
import { personalityFor } from "./personalities";
import { computeTeamPhase, positionPriority } from "./strategy";
import {
  pickKeyOf, playerTradeValue, pickTradeValue,
  valueOfAssetsTo, baseValueOf,
} from "./tradeValue";
import { validateAssets, validateCap, executeTrade, newTradeId } from "./tradeExecute";
import { clamp } from "@/lib/utils";

// =====================================================================
// Trade AI — proposal generation and acceptance logic.
// Two flow types:
//   - CPU↔CPU: auto-execute (mid-season + offseason batch)
//   - CPU→User: appended to league.pendingOffers for user response
// =====================================================================

export interface AcceptEvaluation {
  fairness: number;            // (received value) / (given value)
  accept: boolean;
  reason: string;
}

const ACCEPT_FAIRNESS_BASE = 0.92;

/** Decide whether a team would accept an offer where they receive `gets` and give `gives`. */
export function evaluateAcceptance(
  league: League,
  teamId: string,
  gets: TradeAsset[],
  gives: TradeAsset[],
): AcceptEvaluation {
  const personality = personalityFor(teamId);
  const phase = computeTeamPhase(league, teamId);

  const getVal = valueOfAssetsTo(league, teamId, gets);
  const giveVal = valueOfAssetsTo(league, teamId, gives);

  if (giveVal === 0 && getVal === 0) {
    return { fairness: 1, accept: false, reason: "Empty offer" };
  }
  if (giveVal === 0) {
    return { fairness: 99, accept: true, reason: "Free assets" };
  }

  const fairness = getVal / Math.max(giveVal, 1);

  // Threshold relaxes if we have desperate need at a position the offer fills.
  const needBoost = computeNeedFitBoost(league, teamId, gets, gives);
  // Aggressive front offices accept slightly worse deals to make moves
  const styleAdj =
    personality.faStyle === "AllIn" ? -0.10 :
    personality.faStyle === "Aggressive" ? -0.05 :
    personality.faStyle === "Conservative" ? +0.04 :
    personality.faStyle === "Bargain" ? +0.06 : 0;

  // Phase: rebuilders demand a premium when shipping vets out (or accept lopsided deals to
  // dump vets for picks); contenders accept slightly worse to add a star
  let phaseAdj = 0;
  const sendingStar = gives.some((a) => {
    if (a.kind !== "player" || !a.playerId) return false;
    const p = league.players[a.playerId];
    return !!p && p.ovr >= 86;
  });
  const sendingVet = gives.some((a) => {
    if (a.kind !== "player" || !a.playerId) return false;
    const p = league.players[a.playerId];
    return !!p && p.age >= 30;
  });
  const receivingStar = gets.some((a) => {
    if (a.kind !== "player" || !a.playerId) return false;
    const p = league.players[a.playerId];
    return !!p && p.ovr >= 86;
  });

  if (phase === "Rebuild") {
    if (sendingStar) phaseAdj += 0.05;       // demand more for stars
    if (sendingVet) phaseAdj -= 0.10;        // happy to dump vets
  } else if (phase === "WinNow") {
    if (receivingStar) phaseAdj -= 0.06;     // pay a premium
  }

  const threshold = clamp(ACCEPT_FAIRNESS_BASE + styleAdj + phaseAdj - needBoost, 0.65, 1.20);
  const accept = fairness >= threshold;

  let reason = "";
  if (accept) {
    if (fairness > 1.05) reason = "Looks like a great fit";
    else reason = "Fair value, fills a need";
  } else {
    if (fairness < 0.7) reason = "We need more";
    else if (fairness < threshold - 0.1) reason = "Asking too much";
    else reason = "Need a bit more value";
  }
  return { fairness, accept, reason };
}

function computeNeedFitBoost(league: League, teamId: string, gets: TradeAsset[], gives: TradeAsset[]): number {
  const pri = positionPriority(league, teamId);
  let boost = 0;
  for (const a of gets) {
    if (a.kind === "player" && a.playerId) {
      const p = league.players[a.playerId];
      if (p) {
        const need = pri[p.position] ?? 0;
        boost += clamp(need * 0.012, 0, 0.10);
      }
    }
  }
  // If they're trading away a starter at a position they're already thin at, they'll demand more
  for (const a of gives) {
    if (a.kind === "player" && a.playerId) {
      const p = league.players[a.playerId];
      if (p && p.depth === "Starter") {
        const need = pri[p.position] ?? 0;
        if (need > 4) boost -= 0.06;
      }
    }
  }
  return boost;
}

// =====================================================================
// Proposal generation
// =====================================================================

/** What kinds of teams a giver wants to deal with. */
function preferredCounterparties(league: League, teamId: string): string[] {
  const myPhase = computeTeamPhase(league, teamId);
  const out: string[] = [];
  for (const t of TEAMS) {
    if (t.id === teamId) continue;
    const theirPhase = computeTeamPhase(league, t.id);
    // Win-Nows trade with Rebuilds/Balanced; Rebuilds trade with Win-Nows
    if (myPhase === "WinNow" && theirPhase !== "WinNow") out.push(t.id);
    else if (myPhase === "Rebuild" && theirPhase !== "Rebuild") out.push(t.id);
    else out.push(t.id);
  }
  return out;
}

/** Pick a target on a partner team that fills our need. */
function pickTradeTarget(league: League, buyerId: string, sellerId: string, rng: RNG): Player | null {
  const need = positionPriority(league, buyerId);
  const sellerRoster = getRoster(league, sellerId);
  // Score each seller player by buyer-fit
  const scored = sellerRoster
    .filter((p) => !p.retired && p.team === sellerId && p.ovr >= 70)
    .map((p) => {
      const fit = (need[p.position] ?? 0) * 1.5 + (p.ovr - 65) + (p.depth === "Starter" ? 4 : 0);
      return { p, fit };
    })
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 5);
  if (!scored.length) return null;
  return rng.weighted(scored, scored.map((_, i) => 5 - i)).p;
}

/** Pick a player the buyer is willing to part with (vet they don't need). */
function pickAssetToOffer(league: League, buyerId: string, rng: RNG): Player | null {
  const phase = computeTeamPhase(league, buyerId);
  const need = positionPriority(league, buyerId);
  const roster = getRoster(league, buyerId);
  const candidates = roster
    .filter((p) => !p.retired && p.depth !== "Starter" && p.ovr >= 70 && p.ovr <= 87)
    .filter((p) => (need[p.position] ?? 0) < 4) // not at a need position
    .filter((p) => phase === "Rebuild" ? p.age <= 28 : true);
  if (!candidates.length) return null;
  return rng.pick(candidates);
}

/** Build assets totaling close to (and >=) `targetValue` from buyer's pool. */
function packageBuyerAssets(
  league: League,
  buyerId: string,
  sellerId: string,
  targetValue: number,
  rng: RNG,
): TradeAsset[] {
  const ownPicks = league.draftPicks
    .filter((dp) => dp.currentTeam === buyerId && !dp.used && dp.year >= league.year)
    .sort((a, b) => a.round - b.round || a.pick - b.pick);
  const tradeable = getRoster(league, buyerId)
    .filter((p) => !p.retired && p.ovr >= 65 && p.ovr <= 86 && p.depth !== "Starter");

  // Greedy: sort all assets by base value desc, pick until threshold met
  type Item = { asset: TradeAsset; v: number };
  const items: Item[] = [];
  for (const dp of ownPicks) {
    items.push({
      asset: { kind: "pick", pickKey: pickKeyOf(dp) },
      v: pickTradeValue(dp.year, dp.round, dp.pick, league.year),
    });
  }
  for (const p of tradeable) {
    items.push({
      asset: { kind: "player", playerId: p.id },
      v: playerTradeValue(p),
    });
  }
  items.sort((a, b) => b.v - a.v);

  // Pick combinations under the target total but within tolerance
  const out: TradeAsset[] = [];
  let total = 0;
  for (const item of items) {
    if (total >= targetValue) break;
    if (total + item.v <= targetValue * 1.18) {
      out.push(item.asset);
      total += item.v;
    }
  }
  // If nothing put together, add the smallest pick available
  if (out.length === 0 && items.length) {
    out.push(items[items.length - 1].asset);
  }
  return out;
}

/** Generate a trade offer from one CPU team to another (or to user). */
export function generateOffer(
  league: League,
  fromTeam: string,
  toTeam: string,
  rng: RNG,
): TradeOffer | null {
  const target = pickTradeTarget(league, fromTeam, toTeam, rng);
  if (!target) return null;
  const targetValueToBuyer = valueOfAssetsTo(league, fromTeam, [{ kind: "player", playerId: target.id }]);
  if (targetValueToBuyer < 100) return null;

  // Buyer offers ~95-110% of seller's value-to-team for the player
  const sellerValue = valueOfAssetsTo(league, toTeam, [{ kind: "player", playerId: target.id }]);
  const aimToOffer = Math.round(sellerValue * (0.96 + rng.float(0, 0.10)));

  const offer = packageBuyerAssets(league, fromTeam, toTeam, aimToOffer, rng);
  if (!offer.length) return null;

  // Sometimes seller throws in a late pick to balance value the other way
  let receiveExtras: TradeAsset[] = [];
  const offered = baseValueOf(league, offer);
  const askedBase = playerTradeValue(target);
  if (offered > askedBase * 1.12) {
    // Seller adds a late pick
    const extra = league.draftPicks
      .filter((dp) => dp.currentTeam === toTeam && !dp.used && dp.year >= league.year && dp.round >= 5)
      .sort((a, b) => b.round - a.round || b.pick - a.pick)[0];
    if (extra) receiveExtras.push({ kind: "pick", pickKey: pickKeyOf(extra) });
  }

  return {
    id: newTradeId(),
    fromTeam,
    toTeam,
    fromAssets: offer,
    toAssets: [{ kind: "player", playerId: target.id }, ...receiveExtras],
    status: "pending",
    year: league.year,
    week: league.phase === "RegularSeason" ? league.week : 0,
    ts: Date.now(),
    byUser: false,
  };
}

// =====================================================================
// Auto-execution loops (CPU↔CPU + CPU→User)
// =====================================================================

/** Run a batch of CPU↔CPU trades. User gets offers in `pendingOffers`. */
export function runTradeBatch(league: League, opts: { maxAttempts: number; userOnly?: boolean }) {
  const seedKey = `trade:${league.year}:${league.week}:${opts.userOnly ? "u" : "x"}`;
  const rng = new RNG(seedKey);

  let executed = 0;
  let proposedToUser = 0;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    // Choose a buyer team biased by aggressive personalities + Win-Now
    const teamPool = TEAMS.map((t) => {
      const personality = personalityFor(t.id);
      const phase = computeTeamPhase(league, t.id);
      let weight = 1;
      if (personality.faStyle === "AllIn") weight = 4;
      else if (personality.faStyle === "Aggressive") weight = 3;
      else if (personality.faStyle === "Conservative") weight = 0.7;
      else if (personality.faStyle === "Bargain") weight = 0.6;
      if (phase === "WinNow") weight *= 1.4;
      if (phase === "Rebuild") weight *= 0.9;
      return { t, weight };
    });
    const buyer = rng.weighted(teamPool, teamPool.map((x) => x.weight)).t;

    // Choose seller — biased by phase complement
    const partners = preferredCounterparties(league, buyer.id);
    const sellerId = rng.pick(partners);

    // If user-only mode, only generate if user is on either side
    if (opts.userOnly && league.userTeam &&
        buyer.id !== league.userTeam && sellerId !== league.userTeam) continue;

    const offer = generateOffer(league, buyer.id, sellerId, rng);
    if (!offer) continue;

    // Validate
    const v1 = validateAssets(league, offer.fromTeam, offer.fromAssets);
    const v2 = validateAssets(league, offer.toTeam, offer.toAssets);
    const v3 = validateCap(league, offer);
    if (!v1.ok || !v2.ok || !v3.ok) continue;

    // If user is the receiver, queue for response
    if (sellerId === league.userTeam) {
      const exists = league.pendingOffers.some(
        (po) => po.status === "pending" && po.fromTeam === buyer.id && sameAssets(po.toAssets, offer.toAssets),
      );
      if (exists) continue;
      offer.message = buildOfferRationale(league, offer);
      league.pendingOffers.push(offer);
      proposedToUser++;
      league.news.unshift({
        id: `offer${offer.id}`,
        year: league.year, week: offer.week, ts: offer.ts,
        category: "Trade",
        headline: `${TEAMS_BY_ID[buyer.id].name} offer trade — ${offer.message}`,
        teamId: buyer.id,
      });
      continue;
    }

    // CPU↔CPU — evaluate seller's acceptance
    const eval0 = evaluateAcceptance(league, sellerId, offer.fromAssets, offer.toAssets);
    if (!eval0.accept) continue;

    // Buyer should also re-confirm value (sanity)
    const evalBuyer = evaluateAcceptance(league, buyer.id, offer.toAssets, offer.fromAssets);
    if (!evalBuyer.accept && evalBuyer.fairness < 0.85) continue;

    executeTrade(league, offer);
    executed++;
  }
  return { executed, proposedToUser };
}

function sameAssets(a: TradeAsset[], b: TradeAsset[]): boolean {
  if (a.length !== b.length) return false;
  const keyOf = (x: TradeAsset) => x.kind + ":" + (x.playerId ?? x.pickKey ?? "");
  const sa = new Set(a.map(keyOf));
  return b.every((x) => sa.has(keyOf(x)));
}

function buildOfferRationale(league: League, offer: TradeOffer): string {
  const fromTeam = TEAMS_BY_ID[offer.fromTeam];
  const target = offer.toAssets.find((a) => a.kind === "player" && a.playerId);
  if (target?.kind === "player" && target.playerId) {
    const p = league.players[target.playerId];
    if (p) return `interested in ${p.firstName} ${p.lastName} (${p.position})`;
  }
  return `interested in your assets`;
}

/** Mid-season tick — modest activity, ramping up near deadline (week 9). */
export function runMidSeasonTrades(league: League) {
  const wk = league.week;
  if (wk < 2 || wk > 9) return { executed: 0, proposedToUser: 0 };
  let attempts = 6;
  if (wk >= 7) attempts = 14;       // deadline crunch
  if (wk === 9) attempts = 22;
  return runTradeBatch(league, { maxAttempts: attempts });
}

/** Heavy offseason batch — most movement happens here. */
export function runOffseasonTrades(league: League) {
  return runTradeBatch(league, { maxAttempts: 60 });
}

// =====================================================================
// User-initiated proposal — returns final disposition (accepted/rejected)
// =====================================================================

export interface UserProposalResult {
  accepted: boolean;
  reason: string;
  fairness: number;
}

export function processUserProposal(
  league: League,
  offer: TradeOffer,
): UserProposalResult {
  const v1 = validateAssets(league, offer.fromTeam, offer.fromAssets);
  if (!v1.ok) return { accepted: false, reason: v1.reason ?? "Invalid assets", fairness: 0 };
  const v2 = validateAssets(league, offer.toTeam, offer.toAssets);
  if (!v2.ok) return { accepted: false, reason: v2.reason ?? "Invalid assets", fairness: 0 };
  const v3 = validateCap(league, offer);
  if (!v3.ok) return { accepted: false, reason: v3.reason ?? "Cap mismatch", fairness: 0 };

  const evalRes = evaluateAcceptance(league, offer.toTeam, offer.fromAssets, offer.toAssets);
  if (!evalRes.accept) {
    return { accepted: false, reason: evalRes.reason, fairness: evalRes.fairness };
  }
  offer.status = "accepted";
  executeTrade(league, offer);
  return { accepted: true, reason: evalRes.reason, fairness: evalRes.fairness };
}
