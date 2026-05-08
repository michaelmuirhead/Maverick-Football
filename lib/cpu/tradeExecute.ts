import type { League, TradeAsset, TradeOffer, TradeRecord } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { parsePickKey, resolveAsset } from "./tradeValue";
import { assignDepthChart, getRoster } from "@/lib/gen/roster";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";

let tradeIdCounter = 1;
export function newTradeId(): string { return `tr${Date.now()}-${tradeIdCounter++}`; }

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/** Verify all assets are still owned by the supposed sender. */
export function validateAssets(league: League, teamId: string, assets: TradeAsset[]): ValidationResult {
  for (const a of assets) {
    if (a.kind === "player" && a.playerId) {
      const p = league.players[a.playerId];
      if (!p) return { ok: false, reason: "Player not found" };
      if (p.team !== teamId) return { ok: false, reason: `${p.firstName} ${p.lastName} is not on ${teamId}` };
      if (p.retired) return { ok: false, reason: `${p.firstName} ${p.lastName} retired` };
    } else if (a.kind === "pick" && a.pickKey) {
      const parsed = parsePickKey(a.pickKey);
      if (!parsed) return { ok: false, reason: "Invalid pick key" };
      const pick = league.draftPicks.find(
        (dp) =>
          dp.year === parsed.year && dp.round === parsed.round && dp.pick === parsed.pick,
      );
      if (!pick) return { ok: false, reason: "Pick not found" };
      if (pick.currentTeam !== teamId) return { ok: false, reason: "Pick not owned by team" };
      if (pick.used) return { ok: false, reason: "Pick already used" };
    } else {
      return { ok: false, reason: "Malformed asset" };
    }
  }
  return { ok: true };
}

/** Verify both teams stay under cap after the swap. */
export function validateCap(league: League, offer: TradeOffer): ValidationResult {
  const fromTeam = TEAMS_BY_ID[offer.fromTeam];
  const toTeam = TEAMS_BY_ID[offer.toTeam];
  if (!fromTeam || !toTeam) return { ok: false, reason: "Unknown team" };

  // Sum AAV exchanged
  let leavingFrom = 0;
  for (const a of offer.fromAssets) {
    if (a.kind === "player" && a.playerId) {
      const p = league.players[a.playerId];
      if (p?.contract) leavingFrom += p.contract.aav;
    }
  }
  let leavingTo = 0;
  for (const a of offer.toAssets) {
    if (a.kind === "player" && a.playerId) {
      const p = league.players[a.playerId];
      if (p?.contract) leavingTo += p.contract.aav;
    }
  }

  const fromPayrollAfter = currentTeamPayroll(league, fromTeam.id) - leavingFrom + leavingTo;
  const toPayrollAfter = currentTeamPayroll(league, toTeam.id) - leavingTo + leavingFrom;

  if (fromPayrollAfter > fromTeam.cap + 0.5) return { ok: false, reason: `${fromTeam.abbr} would be over the cap` };
  if (toPayrollAfter > toTeam.cap + 0.5) return { ok: false, reason: `${toTeam.abbr} would be over the cap` };
  return { ok: true };
}

/** Execute an accepted offer. Mutates league. Returns the resulting record. */
export function executeTrade(league: League, offer: TradeOffer): TradeRecord {
  const fromTeam = TEAMS_BY_ID[offer.fromTeam];
  const toTeam = TEAMS_BY_ID[offer.toTeam];

  // Move fromAssets to toTeam
  for (const a of offer.fromAssets) moveAsset(league, a, fromTeam.id, toTeam.id);
  // Move toAssets to fromTeam
  for (const a of offer.toAssets) moveAsset(league, a, toTeam.id, fromTeam.id);

  // Refresh both depth charts
  assignDepthChart(getRoster(league, fromTeam.id));
  assignDepthChart(getRoster(league, toTeam.id));

  const headline = buildTradeHeadline(league, offer);

  const record: TradeRecord = {
    id: newTradeId(),
    year: offer.year,
    week: offer.week,
    teamA: fromTeam.id,
    teamB: toTeam.id,
    aGives: offer.fromAssets,
    bGives: offer.toAssets,
    ts: Date.now(),
    headline,
  };
  league.tradeLog.unshift(record);

  league.news.unshift({
    id: `trade${record.id}`,
    year: offer.year, week: offer.week, ts: record.ts,
    category: "Trade",
    headline,
    teamId: fromTeam.id,
  });

  return record;
}

function moveAsset(league: League, asset: TradeAsset, fromTeamId: string, toTeamId: string) {
  if (asset.kind === "player" && asset.playerId) {
    const p = league.players[asset.playerId];
    if (!p || p.team !== fromTeamId) return;
    p.team = toTeamId;
    p.depth = "Reserve"; // re-evaluated by depth chart pass
    return;
  }
  if (asset.kind === "pick" && asset.pickKey) {
    const parsed = parsePickKey(asset.pickKey);
    if (!parsed) return;
    const pick = league.draftPicks.find(
      (dp) =>
        dp.year === parsed.year && dp.round === parsed.round && dp.pick === parsed.pick && dp.currentTeam === fromTeamId,
    );
    if (pick) pick.currentTeam = toTeamId;
  }
}

function buildTradeHeadline(league: League, offer: TradeOffer): string {
  const fromTeam = TEAMS_BY_ID[offer.fromTeam];
  const toTeam = TEAMS_BY_ID[offer.toTeam];
  const fromDesc = describeAssets(league, offer.fromAssets) || "future considerations";
  const toDesc = describeAssets(league, offer.toAssets) || "future considerations";
  return `TRADE — ${fromTeam.abbr} send ${fromDesc} to ${toTeam.abbr} for ${toDesc}`;
}

export function describeAssets(league: League, assets: TradeAsset[]): string {
  return assets.map((a) => describeAsset(league, a)).filter(Boolean).join(", ");
}

export function describeAsset(league: League, asset: TradeAsset): string {
  if (asset.kind === "player" && asset.playerId) {
    const p = league.players[asset.playerId];
    if (!p) return "—";
    return `${p.firstName} ${p.lastName} (${p.position}, ${p.ovr})`;
  }
  if (asset.kind === "pick" && asset.pickKey) {
    const parsed = parsePickKey(asset.pickKey);
    if (!parsed) return asset.pickKey;
    return `${parsed.year} R${parsed.round}P${parsed.pick}`;
  }
  return "—";
}
