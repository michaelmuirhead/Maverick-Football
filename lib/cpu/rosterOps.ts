import { RNG } from "@/lib/rng";
import type { League, Player, Position, TradeOffer } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { OVR_WEIGHTS, POSITION_GROUP } from "@/lib/data/positions";
import { computeOVR } from "@/lib/gen/player";
import { evaluateAcceptance } from "./tradeAI";
import { newTradeId } from "./tradeExecute";
import { clamp } from "@/lib/utils";

// =====================================================================
// Position changes, coach poaching, trade counter-offers.
// =====================================================================

// ---------------- Position changes ----------------

const POSITION_TRANSITIONS: Record<Position, Position[]> = {
  QB: ["WR", "TE"],
  RB: ["WR", "FB", "CB"],
  FB: ["RB", "TE"],
  WR: ["CB", "RB", "TE", "FS"],
  TE: ["WR", "RT", "LT", "FB"],
  LT: ["RT", "LG", "RG"],
  LG: ["LT", "RT", "C", "RG"],
  C: ["LG", "RG"],
  RG: ["LG", "C", "RT"],
  RT: ["LT", "LG", "RG", "TE"],
  LE: ["RE", "OLB", "DT"],
  DT: ["LE", "RE"],
  RE: ["LE", "OLB", "DT"],
  MLB: ["OLB", "SS"],
  OLB: ["LE", "RE", "MLB", "SS"],
  CB: ["FS", "WR"],
  FS: ["SS", "CB"],
  SS: ["FS", "MLB", "OLB"],
  K: ["P"],
  P: ["K"],
};

export function eligiblePositionChanges(player: Player): Position[] {
  return POSITION_TRANSITIONS[player.position] ?? [];
}

export function changePlayerPosition(
  league: League, playerId: string, newPos: Position,
): { ok: boolean; reason?: string; oldOvr?: number; newOvr?: number } {
  const p = league.players[playerId];
  if (!p) return { ok: false, reason: "Player not found" };
  if (p.position === newPos) return { ok: false, reason: "Already at that position" };
  if (!eligiblePositionChanges(p).includes(newPos)) return { ok: false, reason: "Not a valid transition for this player" };
  const oldOvr = p.ovr;
  p.position = newPos;
  p.ovr = computeOVR(newPos, p.attributes);
  // Cap potential at the new OVR + small bonus (transition adjustment learning)
  p.pot = Math.max(p.pot, p.ovr + 4);
  if (p.team) {
    league.news.unshift({
      id: `pos-${p.id}-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${p.firstName} ${p.lastName} converts to ${newPos} (was ${oldOvr} OVR, now ${p.ovr})`,
      teamId: p.team, playerId: p.id,
    });
  }
  return { ok: true, oldOvr, newOvr: p.ovr };
}

// ---------------- Coach poaching ----------------

/**
 * Each offseason, ~10% chance per quality coordinator that a rival HC vacancy
 * poaches them. The coordinator becomes an HC candidate elsewhere.
 *
 * This is integrated by the existing carousel via league.coachFreeAgents but
 * emits flavor news so the user sees the market churn.
 */
export function announceCoachPoaching(league: League) {
  // Announce big coordinator promotions for dynasty narrative
  const recentPromotions = (league.mentorships ?? []).filter((m) => m.endYear === league.year);
  for (const m of recentPromotions) {
    const protege = league.coaches[m.proteinId];
    const mentor = league.coaches[m.hcId];
    if (!protege || !mentor) continue;
    league.news.unshift({
      id: `tree-${m.proteinId}-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${protege.firstName} ${protege.lastName} (${TEAMS_BY_ID[m.team]?.abbr}) leaves the ${mentor.lastName} coaching tree to chase HC opportunities`,
    });
  }
}

// ---------------- Trade counter-offers ----------------

/**
 * If the opponent rejects but the offer is close to fair, generate a
 * counter that the user can accept.
 */
export function generateCounterOffer(
  league: League, originalOffer: TradeOffer,
): TradeOffer | null {
  const recipient = originalOffer.toTeam;
  const evalRes = evaluateAcceptance(league, recipient, originalOffer.fromAssets, originalOffer.toAssets);
  // Only counter if fairness is within 0.20 of acceptable
  if (evalRes.fairness >= 0.7 && evalRes.fairness < 0.95) {
    // Counter — recipient asks for one more asset from sender
    const senderTeam = originalOffer.fromTeam;
    const senderPicks = league.draftPicks
      .filter((dp) => dp.currentTeam === senderTeam && !dp.used && dp.year >= league.year)
      .sort((a, b) => a.round - b.round || a.pick - b.pick);
    const senderRoster = Object.values(league.players)
      .filter((p) => p.team === senderTeam && p.depth !== "Starter" && p.ovr >= 70 && p.ovr <= 84);

    const additions: TradeOffer["fromAssets"] = [];
    if (senderPicks[0]) {
      additions.push({ kind: "pick", pickKey: `${senderPicks[0].year}-${senderPicks[0].round}-${senderPicks[0].pick}` });
    } else if (senderRoster[0]) {
      additions.push({ kind: "player", playerId: senderRoster[0].id });
    }
    if (!additions.length) return null;

    const counter: TradeOffer = {
      id: newTradeId(),
      fromTeam: recipient,
      toTeam: senderTeam,
      fromAssets: originalOffer.toAssets,
      toAssets: [...originalOffer.fromAssets, ...additions],
      status: "pending",
      year: originalOffer.year,
      week: originalOffer.week,
      ts: Date.now(),
      byUser: false,
      message: "counter-offer",
    };
    return counter;
  }
  return null;
}
