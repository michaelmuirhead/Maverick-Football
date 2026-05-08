import type { League } from "@/lib/types";
import { TEAMS } from "@/lib/data/teams";
import { teamOvr } from "@/lib/gen/roster";

// =====================================================================
// Power rankings + week-over-week movement arrows.
// =====================================================================

export function computePowerRankings(league: League): string[] {
  return TEAMS
    .map((t) => {
      const standing = league.standings[t.id];
      const wp = (standing.w + standing.t * 0.5) / Math.max(standing.w + standing.l + standing.t, 1);
      const ovr = teamOvr(league, t.id);
      const score = ovr * 0.6 + wp * 30 + (standing.pf - standing.pa) * 0.05;
      return { id: t.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

/** Snapshot rankings to history; called weekly. */
export function snapshotPowerRankings(league: League) {
  const rankings = computePowerRankings(league);
  league.powerRankingHistory = league.powerRankingHistory ?? [];
  league.powerRankingHistory.push({ year: league.year, week: league.week, rankings });
  // Keep last 4 weeks of snapshots only
  if (league.powerRankingHistory.length > 8) {
    league.powerRankingHistory = league.powerRankingHistory.slice(-8);
  }
}

/** Returns previous-week movement for each team: positive = moved up, negative = moved down. */
export function rankingMovement(league: League): Record<string, number> {
  const history = league.powerRankingHistory ?? [];
  if (history.length < 2) return {};
  const current = history[history.length - 1].rankings;
  const previous = history[history.length - 2].rankings;
  const out: Record<string, number> = {};
  current.forEach((id, i) => {
    const prevIdx = previous.indexOf(id);
    if (prevIdx >= 0) out[id] = prevIdx - i; // positive means improved
  });
  return out;
}
