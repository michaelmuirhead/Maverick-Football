import type { League, Player } from "@/lib/types";
import { assignDepthChart, getRoster } from "@/lib/gen/roster";
import { TEAMS_BY_ID } from "@/lib/data/teams";

// =====================================================================
// Practice squad — 12 slots per team, doesn't count against the 53.
// Players on PS aren't simulated. User can elevate to active or release.
// =====================================================================

export const PS_LIMIT = 12;

export function listPracticeSquad(league: League, teamId: string): Player[] {
  const ids = league.practiceSquad[teamId] ?? [];
  return ids.map((id) => league.players[id]).filter((p): p is Player => !!p);
}

export function ensurePsBucket(league: League, teamId: string) {
  if (!league.practiceSquad[teamId]) league.practiceSquad[teamId] = [];
}

export function moveToPracticeSquad(league: League, playerId: string): { ok: boolean; reason?: string } {
  const p = league.players[playerId];
  if (!p || !p.team) return { ok: false, reason: "Player not on a team" };
  if (p.injury?.severity === "Major" || p.injury?.severity === "SeasonEnding") {
    return { ok: false, reason: "Cannot send injured player to PS" };
  }
  ensurePsBucket(league, p.team);
  if (league.practiceSquad[p.team].length >= PS_LIMIT) {
    return { ok: false, reason: "Practice squad full" };
  }
  if (p.depth === "Starter") {
    return { ok: false, reason: "Demote them in the depth chart first" };
  }
  league.practiceSquad[p.team].push(p.id);
  p.onPracticeSquad = true;
  // Refresh depth chart
  assignDepthChart(getRoster(league, p.team));
  return { ok: true };
}

export function elevateFromPracticeSquad(league: League, playerId: string): { ok: boolean; reason?: string } {
  const p = league.players[playerId];
  if (!p || !p.team) return { ok: false, reason: "Player not on a team" };
  if (!p.onPracticeSquad) return { ok: false, reason: "Not on PS" };
  ensurePsBucket(league, p.team);
  league.practiceSquad[p.team] = league.practiceSquad[p.team].filter((id) => id !== p.id);
  p.onPracticeSquad = false;
  assignDepthChart(getRoster(league, p.team));
  return { ok: true };
}

/** During offseason, auto-stash low-OVR backups (66 and below) to PS to keep main roster lean. */
export function autoStashLowEndPlayers(league: League) {
  for (const teamId of Object.keys(league.staffs)) {
    ensurePsBucket(league, teamId);
    const roster = getRoster(league, teamId).filter((p) => !p.onPracticeSquad && !p.injury);
    // Move any player ≤66 OVR who isn't a starter, until PS is full
    const candidates = roster
      .filter((p) => p.depth !== "Starter" && p.ovr <= 66 && !p.retired)
      .sort((a, b) => a.ovr - b.ovr);
    for (const p of candidates) {
      if (league.practiceSquad[teamId].length >= PS_LIMIT) break;
      league.practiceSquad[teamId].push(p.id);
      p.onPracticeSquad = true;
    }
  }
}
