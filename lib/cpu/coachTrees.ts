import type { Coach, CoachMentorship, League } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";

// =====================================================================
// Coaching trees: track HC↔coordinator mentorships. When a coordinator
// who served under HC X gets promoted to HC, log the lineage.
// =====================================================================

/**
 * Called from the coach carousel whenever a coordinator becomes an HC.
 * `protege` is the coordinator (now becoming HC). We attribute mentorship
 * to the HC under whom they served on their previous team.
 */
export function recordPromotionMentorship(
  league: League, protege: Coach, prevTeamId: string, prevHcId: string,
) {
  // Only record once per pair
  const exists = league.mentorships.some(
    (m) => m.hcId === prevHcId && m.proteinId === protege.id,
  );
  if (exists) return;
  // Use the protege's most recent stint at prevTeamId for years
  const lastStint = [...protege.history].reverse().find(
    (h) => h.team === prevTeamId && (h.role === "OC" || h.role === "DC"),
  );
  league.mentorships.push({
    hcId: prevHcId,
    proteinId: protege.id,
    startYear: lastStint?.year ?? league.year,
    endYear: league.year,
    team: prevTeamId,
  });
  if (protege.mentorId == null) protege.mentorId = prevHcId;
}

/** All proteges of a given HC. */
export function getProteges(league: League, hcId: string): Coach[] {
  return league.mentorships
    .filter((m) => m.hcId === hcId)
    .map((m) => league.coaches[m.proteinId])
    .filter((c): c is Coach => !!c);
}

/** Recursive coaching tree starting from `rootHcId`. */
export interface TreeNode { coach: Coach; children: TreeNode[] }

export function buildTree(league: League, rootHcId: string, visited = new Set<string>()): TreeNode | null {
  if (visited.has(rootHcId)) return null;
  visited.add(rootHcId);
  const root = league.coaches[rootHcId];
  if (!root) return null;
  const proteges = getProteges(league, rootHcId);
  const children: TreeNode[] = [];
  for (const p of proteges) {
    const node = buildTree(league, p.id, visited);
    if (node) children.push(node);
  }
  return { coach: root, children };
}
