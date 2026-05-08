import { RNG } from "@/lib/rng";
import type {
  CombineNumbers, DraftProspect, League, MockDraft, MockDraftPick, Position,
} from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { positionPriority, teamScoutGrade } from "./strategy";
import { personalityFor } from "./personalities";
import { POSITION_GROUP } from "@/lib/data/positions";
import { clamp } from "@/lib/utils";

// =====================================================================
// Pre-draft scouting depth: combine numbers per prospect, weekly mock
// drafts during the season, and a scouting budget for the user that
// reveals true POT for selected prospects.
// =====================================================================

export const STARTING_SCOUTING_POINTS = 100;
export const SCOUT_COST_PER_PROSPECT = 6;

/** Generate combine numbers from attributes (deterministic, used at class creation). */
export function generateCombine(prospect: DraftProspect, rng: RNG): CombineNumbers {
  const a = prospect.attributes;
  const speed = a.spd ?? 70;
  const acc = a.acc ?? 70;
  const str = a.str ?? 70;
  const jmp = a.jmp ?? 70;
  const agi = a.agi ?? 70;
  // 40 yard: 4.20 (great) → 5.10 (slow). speed ~99 ≈ 4.20, ~50 ≈ 5.05
  const fortyBase = 5.20 - (speed / 99) * 0.95 - (acc / 99) * 0.10;
  const forty = clamp(Math.round((fortyBase + rng.normal(0, 0.05)) * 100) / 100, 4.18, 5.30);
  const bench = clamp(Math.round((str / 99) * 38 + rng.normal(0, 3)), 4, 50);
  const vert = clamp(Math.round((jmp / 99) * 44 + rng.normal(0, 3)), 22, 46);
  const broad = clamp(Math.round((jmp / 99) * 132 + (speed / 99) * 14 + rng.normal(0, 4)), 100, 145);
  const threeCone = clamp(Math.round((7.6 - (agi / 99) * 0.95 + rng.normal(0, 0.06)) * 100) / 100, 6.50, 7.95);
  return { fortyYd: forty, bench, vertical: vert, broad, threeCone };
}

export function attachCombineNumbers(prospects: DraftProspect[], rng: RNG): void {
  for (const p of prospects) {
    (p as any).combine = generateCombine(p, rng);
  }
}

export function getCombine(prospect: DraftProspect): CombineNumbers | undefined {
  return (prospect as any).combine;
}

/**
 * Spend scouting points on a prospect — reveals true POT (rarely OVR) and
 * returns true on success.
 */
export function userScoutProspect(
  league: League, prospectId: string,
): { ok: boolean; reason?: string; cost: number; revealed?: { pot: number } } {
  if (!league.userTeam) return { ok: false, reason: "No user team", cost: 0 };
  const points = league.scoutingPoints[league.userTeam] ?? 0;
  if (points < SCOUT_COST_PER_PROSPECT) return { ok: false, reason: "Not enough scouting points", cost: 0 };
  const prospect = league.draftClass.find((p) => p.id === prospectId);
  if (!prospect) return { ok: false, reason: "Prospect not found", cost: 0 };
  if (league.scoutedProspects.includes(prospectId)) {
    return { ok: false, reason: "Already scouted", cost: 0 };
  }
  league.scoutingPoints[league.userTeam] = points - SCOUT_COST_PER_PROSPECT;
  league.scoutedProspects.push(prospectId);
  return { ok: true, cost: SCOUT_COST_PER_PROSPECT, revealed: { pot: prospect.pot } };
}

export function userHasScouted(league: League, prospectId: string): boolean {
  return league.scoutedProspects.includes(prospectId);
}

/** Build a weekly mock draft (one pick per team in projected draft order). */
export function buildMockDraft(league: League, week: number): MockDraft {
  const rng = new RNG(`mock:${league.year}:${week}`);
  // Project draft order from current standings (worst-first in regular season)
  const order = TEAMS.map((t) => {
    const s = league.standings[t.id];
    const wp = (s.w + s.t * 0.5) / Math.max(s.w + s.l + s.t, 1);
    return { teamId: t.id, wp, pf: s.pf, pa: s.pa };
  }).sort((a, b) => a.wp - b.wp || (a.pf - a.pa) - (b.pf - b.pa));

  // For each team, pick the prospect with highest team-grade among available
  const taken = new Set<string>();
  const picks: MockDraftPick[] = [];
  for (let i = 0; i < order.length; i++) {
    const teamId = order[i].teamId;
    const need = positionPriority(league, teamId);
    const candidates = league.draftClass
      .filter((p) => !taken.has(p.id))
      .map((p) => {
        const grade = teamScoutGrade(league, teamId, p, p.scoutGrade);
        const fit = (need[p.position] ?? 0) * 1.5;
        return { p, score: grade + fit };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (!candidates.length) break;
    const pick = rng.weighted(candidates, candidates.map((_, j) => 5 - j)).p;
    taken.add(pick.id);
    picks.push({ team: teamId, prospectId: pick.id });
  }
  return { year: league.year + 1, publishedWeek: week, picks };
}

/** Each week starting from week 6 of regular season, publish a mock draft and a news headline. */
export function publishWeeklyMockDraftIfApplicable(league: League) {
  if (league.phase !== "RegularSeason") return;
  if (league.week < 6) return;
  const md = buildMockDraft(league, league.week);
  league.mockDraft = md;
  // Top-3 highlight news
  const topIds = md.picks.slice(0, 3);
  const top1 = topIds[0];
  if (top1) {
    const p = league.draftClass.find((x) => x.id === top1.prospectId);
    if (p) {
      league.news.unshift({
        id: `mock-${league.year}-${league.week}`,
        year: league.year, week: league.week, ts: Date.now(),
        category: "Draft",
        headline: `Mock Draft ${league.year + 1}: ${TEAMS_BY_ID[top1.team].abbr} project to take ${p.firstName} ${p.lastName} (${p.position}, ${p.college}) #1 overall`,
      });
    }
  }
}
