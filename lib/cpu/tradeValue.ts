import type { League, Player, Position, TradeAsset, DraftPick } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { schemeFit, personalityFor } from "./personalities";
import { positionPriority, computeTeamPhase } from "./strategy";
import { clamp } from "@/lib/utils";

// =====================================================================
// Trade value chart. Outputs are dimensionless "trade points" calibrated
// roughly against the Jimmy Johnson draft pick chart, so a star QB ~=
// a top-15 pick, a solid starter ~= a 2nd-rounder, depth ~= a late pick.
// =====================================================================

export const POS_TRADE_PREMIUM: Record<Position, number> = {
  QB: 2.10,
  LE: 1.50, RE: 1.50,
  LT: 1.40, RT: 1.30,
  WR: 1.32,
  CB: 1.32,
  DT: 1.18,
  OLB: 1.10,
  TE: 1.05,
  LG: 1.00, RG: 1.00, C: 1.05,
  MLB: 1.00,
  FS: 0.92, SS: 0.92,
  RB: 0.85,
  K: 0.45, P: 0.40, FB: 0.40,
};

export function ageCurve(age: number): number {
  if (age <= 23) return 1.10;
  if (age <= 26) return 1.08;
  if (age <= 29) return 1.00;
  if (age === 30) return 0.85;
  if (age === 31) return 0.75;
  if (age === 32) return 0.62;
  if (age === 33) return 0.50;
  return 0.35;
}

/** Drag from an oversized contract on an aging player. */
function contractDrag(player: Player): number {
  if (!player.contract) return 0;
  const aav = player.contract.aav;
  // Steep contracts on declining vets are toxic
  const ageMult = player.age >= 32 ? 1.5 : player.age >= 30 ? 1.0 : 0.5;
  if (aav >= 30) return aav * 6 * ageMult;
  if (aav >= 20) return aav * 4 * ageMult;
  if (aav >= 12) return aav * 2 * ageMult;
  return 0;
}

/** Base trade value of a player in points. */
export function playerTradeValue(player: Player): number {
  if (player.retired) return 0;
  const ovrCore = Math.pow(Math.max(0, player.ovr - 60), 1.6) * 1.4;
  const posMult = POS_TRADE_PREMIUM[player.position] ?? 1.0;
  const ageMult = ageCurve(player.age);
  const potBonus = Math.max(0, player.pot - player.ovr) * (player.age <= 24 ? 5.5 : player.age <= 27 ? 3 : 1);
  const drag = contractDrag(player);
  const raw = (ovrCore + potBonus) * posMult * ageMult - drag;
  return Math.max(0, Math.round(raw));
}

/**
 * Player value to a specific team (with need + scheme + phase mods).
 * Used when teamId would be acquiring this player.
 */
export function playerValueToTeam(league: League, teamId: string, player: Player): number {
  const base = playerTradeValue(player);
  if (base <= 0) return 0;
  const team = TEAMS_BY_ID[teamId];
  const fit = schemeFit(team, player.position);
  const need = positionPriority(league, teamId)[player.position] ?? 0;
  const personality = personalityFor(teamId);
  const phase = computeTeamPhase(league, teamId);

  let phaseMult = 1.0;
  if (phase === "WinNow") {
    phaseMult = player.age <= 28 ? 1.10 : player.age <= 31 ? 1.18 : 1.05;
  } else if (phase === "Rebuild") {
    phaseMult = player.age >= 30 ? 0.45 : player.age <= 25 ? 1.20 : 0.85;
  }

  // Win-Now contenders pay a star tax for difference-makers
  let starTax = 1.0;
  if (player.ovr >= 88 && phase === "WinNow") starTax = 1.10;
  if (player.ovr >= 92 && personality.faStyle === "AllIn") starTax = 1.20;

  const needMult = clamp(0.85 + need * 0.045, 0.75, 1.40);
  return Math.round(base * fit * phaseMult * starTax * needMult);
}

/** Jimmy Johnson chart approximation. */
export function pickTradeValue(year: number, round: number, pick: number, currentYear: number): number {
  const overall = (round - 1) * 32 + pick;
  let v: number;
  if (overall <= 1) v = 3000;
  else if (overall <= 5) v = 2200 - (overall - 1) * 110;
  else if (overall <= 16) v = 1600 - (overall - 5) * 36;
  else if (overall <= 32) v = 1100 - (overall - 16) * 25;
  else if (overall <= 64) v = 580 - (overall - 32) * 7;
  else if (overall <= 100) v = 320 - (overall - 64) * 4;
  else if (overall <= 160) v = 160 - (overall - 100) * 1.7;
  else v = 30;

  const yearsOut = year - currentYear;
  if (yearsOut === 1) v *= 0.78;
  else if (yearsOut === 2) v *= 0.60;
  else if (yearsOut >= 3) v *= 0.45;

  return Math.max(1, Math.round(v));
}

export function pickValueToTeam(league: League, teamId: string, year: number, round: number, pick: number): number {
  const base = pickTradeValue(year, round, pick, league.year);
  const phase = computeTeamPhase(league, teamId);
  // Rebuilders value picks higher; contenders value them lower
  const phaseMult = phase === "Rebuild" ? 1.20 : phase === "WinNow" ? 0.85 : 1.0;
  return Math.round(base * phaseMult);
}

// ========== Asset helpers ==========

export interface ResolvedAsset {
  asset: TradeAsset;
  player?: Player;
  pick?: DraftPick;
  baseValue: number;
}

export function parsePickKey(key: string): { year: number; round: number; pick: number } | null {
  const m = key.match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return null;
  return { year: parseInt(m[1]), round: parseInt(m[2]), pick: parseInt(m[3]) };
}

export function pickKeyOf(p: DraftPick): string {
  return `${p.year}-${p.round}-${p.pick}`;
}

export function resolveAsset(league: League, asset: TradeAsset): ResolvedAsset {
  if (asset.kind === "player" && asset.playerId) {
    const player = league.players[asset.playerId];
    return { asset, player, baseValue: player ? playerTradeValue(player) : 0 };
  }
  if (asset.kind === "pick" && asset.pickKey) {
    const parsed = parsePickKey(asset.pickKey);
    const pick = league.draftPicks.find(
      (dp) => parsed && dp.year === parsed.year && dp.round === parsed.round && dp.pick === parsed.pick,
    );
    const baseValue = parsed ? pickTradeValue(parsed.year, parsed.round, parsed.pick, league.year) : 0;
    return { asset, pick, baseValue };
  }
  return { asset, baseValue: 0 };
}

/** Total team-specific value when teamId would be ACQUIRING these assets. */
export function valueOfAssetsTo(league: League, teamId: string, assets: TradeAsset[]): number {
  let sum = 0;
  for (const a of assets) {
    if (a.kind === "player" && a.playerId) {
      const p = league.players[a.playerId];
      if (p) sum += playerValueToTeam(league, teamId, p);
    } else if (a.kind === "pick" && a.pickKey) {
      const parsed = parsePickKey(a.pickKey);
      if (parsed) sum += pickValueToTeam(league, teamId, parsed.year, parsed.round, parsed.pick);
    }
  }
  return sum;
}

/** Sum of base (team-agnostic) value. Used for symmetry-checking and UI display. */
export function baseValueOf(league: League, assets: TradeAsset[]): number {
  let sum = 0;
  for (const a of assets) sum += resolveAsset(league, a).baseValue;
  return sum;
}
