import { RNG } from "@/lib/rng";
import type {
  Achievement, AllDecadeSlot, AllDecadeTeam, CbaEvent, League, Player, Position,
} from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";

// =====================================================================
// Achievements, All-Decade teams, and CBA events.
// =====================================================================

// ---------------- Achievements ----------------

interface AchievementCheck {
  id: string;
  category: Achievement["category"];
  title: string;
  detail?: (league: League) => string;
  check: (league: League) => { unlocked: boolean; teamId?: string; playerId?: string };
}

const ACHIEVEMENT_CHECKS: AchievementCheck[] = [
  {
    id: "first_championship",
    category: "Championship",
    title: "First championship",
    check: (lg) => {
      const champ = lg.champions.find((c) => c.team === lg.userTeam);
      return { unlocked: !!champ, teamId: champ?.team };
    },
  },
  {
    id: "back_to_back",
    category: "Championship",
    title: "Back-to-back champions",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const champs = lg.champions.filter((c) => c.team === lg.userTeam).sort((a, b) => a.year - b.year);
      for (let i = 1; i < champs.length; i++) {
        if (champs[i].year - champs[i - 1].year === 1) return { unlocked: true, teamId: lg.userTeam! };
      }
      return { unlocked: false };
    },
  },
  {
    id: "three_peat",
    category: "Championship",
    title: "Three-peat dynasty",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const champs = lg.champions.filter((c) => c.team === lg.userTeam).sort((a, b) => a.year - b.year);
      for (let i = 2; i < champs.length; i++) {
        if (champs[i].year - champs[i - 1].year === 1 && champs[i - 1].year - champs[i - 2].year === 1) {
          return { unlocked: true, teamId: lg.userTeam! };
        }
      }
      return { unlocked: false };
    },
  },
  {
    id: "perfect_season",
    category: "Season",
    title: "Perfect regular season",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const s = lg.standings[lg.userTeam];
      return { unlocked: s && s.w >= 18 && s.l === 0, teamId: lg.userTeam! };
    },
  },
  {
    id: "fifteen_wins",
    category: "Season",
    title: "15+ win season",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const s = lg.standings[lg.userTeam];
      return { unlocked: s && s.w >= 15, teamId: lg.userTeam! };
    },
  },
  {
    id: "decade_dynasty",
    category: "Career",
    title: "Decade dynasty (10 seasons)",
    detail: (lg) => `${lg.year - lg.founded} seasons in`,
    check: (lg) => ({ unlocked: lg.year - lg.founded >= 10, teamId: lg.userTeam ?? undefined }),
  },
  {
    id: "century_club",
    category: "Career",
    title: "100 career wins as user",
    detail: (lg) => {
      const total = lg.userCareer?.stints.reduce((s, st) => s + st.wins, 0) ?? 0;
      return `${total} career wins`;
    },
    check: (lg) => {
      const total = lg.userCareer?.stints.reduce((s, st) => s + st.wins, 0) ?? 0;
      return { unlocked: total >= 100 };
    },
  },
  {
    id: "rookie_to_riches",
    category: "Roster",
    title: "Drafted Hall-of-Famer",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const hof = lg.hall
        .map((id) => lg.players[id])
        .filter((p): p is Player => !!p)
        .find((p) => p.draftRound !== undefined && lg.champions.some((c) => c.team === p.team));
      return { unlocked: !!hof, playerId: hof?.id };
    },
  },
  {
    id: "five_star_team",
    category: "Roster",
    title: "5+ Pro Bowlers in one season",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const proBowlers = lg.awards.filter(
        (a) => a.year === lg.year && a.type === "ProBowl" && a.team === lg.userTeam,
      ).length;
      return { unlocked: proBowlers >= 5, teamId: lg.userTeam! };
    },
  },
  {
    id: "draft_savant",
    category: "Career",
    title: "Drafted 10 Pro Bowlers",
    check: (lg) => {
      if (!lg.userTeam) return { unlocked: false };
      const drafted = Object.values(lg.players).filter(
        (p) => p.draftYear !== undefined && p.draftRound !== undefined && p.history.some((h) => h.proBowl),
      );
      return { unlocked: drafted.length >= 10, teamId: lg.userTeam! };
    },
  },
];

/** Run all achievement checks; emit news + add to league.achievements for any newly unlocked. */
export function checkAchievements(league: League) {
  league.achievements = league.achievements ?? [];
  const already = new Set(league.achievements.map((a) => a.id));
  for (const check of ACHIEVEMENT_CHECKS) {
    if (already.has(check.id)) continue;
    const r = check.check(league);
    if (!r.unlocked) continue;
    const ach: Achievement = {
      id: check.id,
      unlockedYear: league.year,
      category: check.category,
      title: check.title,
      detail: check.detail?.(league),
      teamId: r.teamId,
      playerId: r.playerId,
    };
    league.achievements.push(ach);
    league.news.unshift({
      id: `ach-${check.id}-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `🏆 Achievement unlocked: ${check.title}${ach.detail ? ` (${ach.detail})` : ""}`,
      teamId: r.teamId,
      playerId: r.playerId,
    });
  }
}

// ---------------- All-Decade teams ----------------

/** Pick the best 22 players over the past 10 years (since founding) by Pro Bowl tally. */
export function maybeNameAllDecadeTeam(league: League) {
  const yearsSinceFound = league.year - league.founded;
  if (yearsSinceFound === 0 || yearsSinceFound % 10 !== 0) return;
  const decadeStart = league.year - 10;
  const decadeEnd = league.year - 1;
  league.allDecadeTeams = league.allDecadeTeams ?? [];
  if (league.allDecadeTeams.some((t) => t.decade === decadeStart)) return;

  const slotPositions: Position[] = [
    "QB", "RB", "RB", "WR", "WR", "WR", "TE",
    "LT", "LG", "C", "RG", "RT",
    "LE", "DT", "DT", "RE",
    "MLB", "OLB", "OLB",
    "CB", "CB", "FS", "SS", "K", "P",
  ];

  const slots: AllDecadeSlot[] = [];
  const used = new Set<string>();

  for (const pos of slotPositions) {
    const candidates = Object.values(league.players)
      .filter((p) => !used.has(p.id))
      .filter((p) => p.position === pos)
      .map((p) => {
        const decadePB = p.history.filter((h) => h.year >= decadeStart && h.year <= decadeEnd && h.proBowl).length;
        const decadeAP = p.history.filter((h) => h.year >= decadeStart && h.year <= decadeEnd && h.allPro).length;
        const decadeMVP = p.history.filter((h) => h.year >= decadeStart && h.year <= decadeEnd && h.mvp).length;
        const score = decadePB + decadeAP * 2.5 + decadeMVP * 5;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (candidates[0]) {
      slots.push({ position: pos, playerId: candidates[0].p.id });
      used.add(candidates[0].p.id);
    }
  }

  const team: AllDecadeTeam = {
    decade: decadeStart,
    endYear: decadeEnd,
    slots,
    awarded: league.year,
  };
  league.allDecadeTeams.push(team);

  league.news.unshift({
    id: `alldecade-${decadeStart}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `${decadeStart}s All-Decade Team announced — ${slots.length} players honored`,
  });
}

// ---------------- CBA events ----------------

const CBA_EVENTS: { type: CbaEvent["type"]; summary: string; effect?: CbaEvent["effect"] }[] = [
  { type: "CapStructure", summary: "League announces 5% one-time cap surge", effect: { capInflationDelta: 0.05 } },
  { type: "CapStructure", summary: "Owners' lockout — flat cap year (no inflation)", effect: { capInflationDelta: -0.065 } },
  { type: "ScheduleFormat", summary: "Schedule expansion — alternate-year extra week" },
  { type: "DraftFormat", summary: "Draft restructured — extra compensatory picks awarded league-wide" },
  { type: "RookieScale", summary: "Rookie wage scale revised slightly upward" },
  { type: "Other", summary: "International game expanded — Sunday morning slot added" },
  // Rule changes that mechanically affect the sim
  { type: "RuleChange",
    summary: "Defensive holding flagged more aggressively — completion percentages tick up league-wide",
    effect: { completionMultGlobal: 1.04, durationYears: 4 } },
  { type: "RuleChange",
    summary: "Targeting / helmet rule introduced — fewer big collisions, fewer concussions",
    effect: { injuryRateMod: -0.18, bigPlayRateMod: -0.005, durationYears: 6 } },
  { type: "RuleChange",
    summary: "Pass-interference review expanded — coordinators dial back deep shots",
    effect: { bigPlayRateMod: -0.008, durationYears: 3 } },
  { type: "RuleChange",
    summary: "Holding-on-OL crackdown — running game gets harder",
    effect: { rushYpcMult: 0.94, durationYears: 3 } },
  { type: "RuleChange",
    summary: "Quarterback protection rules tightened — completions tick up",
    effect: { completionMultGlobal: 1.02, durationYears: 4 } },
  { type: "RuleChange",
    summary: "Kickoff fair-catch rule revised — slightly easier FG range",
    effect: { fgRangeBonus: -1, durationYears: 5 } },
];

/** Every 8-12 years, fire a random CBA event. */
export function maybeFireCbaEvent(league: League) {
  const yearsSinceFound = league.year - league.founded;
  if (yearsSinceFound === 0) return;
  const lastCba = (league.cbaEvents ?? []).slice(-1)[0];
  const lastYear = lastCba?.year ?? league.founded;
  if (league.year - lastYear < 8) return;
  const rng = new RNG(`cba:${league.year}`);
  if (!rng.chance(0.25)) return;
  const evt = rng.pick(CBA_EVENTS);
  league.cbaEvents = league.cbaEvents ?? [];
  league.cbaEvents.push({ year: league.year, type: evt.type, summary: evt.summary, effect: evt.effect });
  // Apply cap effect immediately
  if (evt.effect?.capInflationDelta) {
    league.capInflation = Math.max(0.5, (league.capInflation ?? 1) * (1 + evt.effect.capInflationDelta));
  }
  // Push duration-based rule effects into the active list
  if (evt.effect && evt.type === "RuleChange") {
    league.activeRuleEffects = league.activeRuleEffects ?? [];
    league.activeRuleEffects.push({
      ...evt.effect,
      appliedYear: league.year,
      durationYears: evt.effect.durationYears ?? 3,
    });
  }
  league.news.unshift({
    id: `cba-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `📜 CBA event: ${evt.summary}`,
  });
}

/** Expire active rule effects whose duration has lapsed. */
export function expireRuleEffects(league: League) {
  league.activeRuleEffects = (league.activeRuleEffects ?? []).filter((e) => {
    const applied = e.appliedYear ?? league.year;
    const dur = e.durationYears ?? 3;
    return league.year - applied < dur;
  });
}

/** Aggregate the currently active rule effects into a single mod object. */
export function aggregateRuleEffects(league: League): {
  completionMultGlobal: number;
  bigPlayRateMod: number;
  injuryRateMod: number;
  fgRangeBonus: number;
  rushYpcMult: number;
} {
  const out = {
    completionMultGlobal: 1.0,
    bigPlayRateMod: 0,
    injuryRateMod: 0,
    fgRangeBonus: 0,
    rushYpcMult: 1.0,
  };
  for (const e of league.activeRuleEffects ?? []) {
    if (e.completionMultGlobal != null) out.completionMultGlobal *= e.completionMultGlobal;
    if (e.bigPlayRateMod != null) out.bigPlayRateMod += e.bigPlayRateMod;
    if (e.injuryRateMod != null) out.injuryRateMod += e.injuryRateMod;
    if (e.fgRangeBonus != null) out.fgRangeBonus += e.fgRangeBonus;
    if (e.rushYpcMult != null) out.rushYpcMult *= e.rushYpcMult;
  }
  return out;
}
