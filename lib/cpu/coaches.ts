import { RNG } from "@/lib/rng";
import type {
  Coach, CoachAttrs, CoachRole, CoachStaff, DefenseScheme, League,
  OffenseScheme,
} from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { FIRST_NAMES, LAST_NAMES } from "@/lib/data/names";
import { personalityFor } from "./personalities";
import { clamp } from "@/lib/utils";

let coachIdCounter = 1;
export function newCoachId(): string { return `c${coachIdCounter++}`; }
export function setCoachIdSeed(n: number) { coachIdCounter = n; }
export function currentCoachIdSeed() { return coachIdCounter; }

export type CoachTier = "elite" | "good" | "average" | "poor";

const TIER_BASE: Record<CoachTier, number> = {
  elite: 88, good: 78, average: 68, poor: 58,
};

const OFFENSE_SCHEMES: OffenseScheme[] = ["Air Raid", "West Coast", "Spread", "Pro Style", "Power Run"];
const DEFENSE_SCHEMES: DefenseScheme[] = ["4-3", "3-4", "Nickel D", "Cover 2", "Tampa 2"];

function genAttr(rng: RNG, mean: number, sd = 6): number {
  return clamp(Math.round(rng.normal(mean, sd)), 40, 99);
}

interface GenerateCoachOpts {
  role: CoachRole;
  rng: RNG;
  tier?: CoachTier;
  preferredOffScheme?: OffenseScheme;
  preferredDefScheme?: DefenseScheme;
  ageRange?: [number, number];
  yearsRange?: [number, number];
  team?: string | null;
}

export function generateCoach(opts: GenerateCoachOpts): Coach {
  const { rng, role } = opts;
  const tier = opts.tier ?? rng.weighted<CoachTier>(
    ["elite", "good", "average", "poor"],
    [0.06, 0.24, 0.55, 0.15],
  );
  const base = TIER_BASE[tier];
  const [aMin, aMax] = opts.ageRange ?? (role === "HC" ? [38, 65] : [33, 60]);
  const age = clamp(Math.round(rng.float(aMin, aMax)), aMin, aMax);
  const [yMin, yMax] = opts.yearsRange ?? [2, Math.max(2, age - 30)];
  const yearsExp = clamp(rng.int(yMin, yMax), 0, 35);

  const attrs: CoachAttrs = {
    leadership: genAttr(rng, base),
    scheme: genAttr(rng, base + 2),
    development: genAttr(rng, base - 2, 8),
    decisionMaking: genAttr(rng, base, 7),
  };
  if (role === "OC" || role === "HC") {
    attrs.passing = genAttr(rng, base);
    attrs.rushing = genAttr(rng, base);
  }
  if (role === "DC" || role === "HC") {
    attrs.blitz = genAttr(rng, base, 9);
    attrs.coverage = genAttr(rng, base);
  }

  const offenseScheme: OffenseScheme | undefined = (role === "OC" || role === "HC")
    ? opts.preferredOffScheme ?? rng.pick(OFFENSE_SCHEMES)
    : undefined;
  const defenseScheme: DefenseScheme | undefined = (role === "DC" || role === "HC")
    ? opts.preferredDefScheme ?? rng.pick(DEFENSE_SCHEMES)
    : undefined;

  // Aggression and tempo for HCs (others get sensible defaults but unused)
  const fourthDownAgg = clamp(rng.normal(0.45, 0.18), 0.10, 0.92);
  const tempo = clamp(rng.normal(0.5, 0.15), 0.20, 0.85);
  const reputation = clamp(Math.round(rng.normal(base - 5, 8)), 40, 95);

  return {
    id: newCoachId(),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    role,
    team: opts.team ?? null,
    yearsExperience: yearsExp,
    attrs,
    offenseScheme,
    defenseScheme,
    fourthDownAgg,
    tempo,
    reputation,
    retired: false,
    history: [],
    careerWins: 0,
    careerLosses: 0,
    championships: 0,
    cotyAwards: 0,
  };
}

/** Initialize the league's coaching staffs at season start. */
export function initializeCoachingStaffs(league: League, rng: RNG) {
  league.coaches = {};
  league.staffs = {};
  league.coachFreeAgents = [];

  for (const team of TEAMS) {
    const personality = personalityFor(team.id);

    // HC tier biased by team prestige
    const hcTier = pickTierFromPrestige(team.prestige, rng);

    const hc = generateCoach({
      role: "HC", rng, tier: hcTier, team: team.id,
      preferredOffScheme: team.offenseScheme,
      preferredDefScheme: team.defenseScheme,
    });
    // Sync HC tendencies with team personality so it feels coherent at start
    hc.fourthDownAgg = clamp((hc.fourthDownAgg + personality.fourthDownAggression) / 2, 0.1, 0.95);
    hc.tempo = clamp((hc.tempo + personality.tempo) / 2, 0.1, 0.9);

    const oc = generateCoach({
      role: "OC", rng,
      tier: rotateTier(hcTier, rng),
      team: team.id,
      preferredOffScheme: team.offenseScheme,
    });
    const dc = generateCoach({
      role: "DC", rng,
      tier: rotateTier(hcTier, rng),
      team: team.id,
      preferredDefScheme: team.defenseScheme,
    });

    league.coaches[hc.id] = hc;
    league.coaches[oc.id] = oc;
    league.coaches[dc.id] = dc;
    league.staffs[team.id] = { teamId: team.id, hc: hc.id, oc: oc.id, dc: dc.id };
  }

  // Free-agent pool
  for (let i = 0; i < 20; i++) {
    const role = rng.weighted<CoachRole>(["HC", "OC", "DC"], [0.25, 0.40, 0.35]);
    const c = generateCoach({ role, rng, team: null });
    league.coaches[c.id] = c;
    league.coachFreeAgents.push(c.id);
  }
}

function pickTierFromPrestige(prestige: number, rng: RNG): CoachTier {
  const r = rng.next();
  if (prestige >= 88) {
    if (r < 0.25) return "elite";
    if (r < 0.7) return "good";
    return "average";
  }
  if (prestige >= 78) {
    if (r < 0.10) return "elite";
    if (r < 0.55) return "good";
    if (r < 0.90) return "average";
    return "poor";
  }
  if (r < 0.04) return "elite";
  if (r < 0.30) return "good";
  if (r < 0.80) return "average";
  return "poor";
}

function rotateTier(t: CoachTier, rng: RNG): CoachTier {
  // Coordinators average ~one tier lower than HC, with noise
  const order: CoachTier[] = ["elite", "good", "average", "poor"];
  const idx = order.indexOf(t);
  const shift = rng.weighted([0, 1, -1, 2], [0.45, 0.35, 0.10, 0.10]);
  return order[clamp(idx + shift, 0, order.length - 1)];
}

// =====================================================================
// Coach carousel (offseason)
// =====================================================================

export function runCoachCarousel(league: League) {
  const rng = new RNG(`coach:${league.year}`);

  // 1) Record season results into HC history + career stats
  for (const teamId of TEAMS.map((t) => t.id)) {
    const staff = league.staffs[teamId];
    if (!staff) continue;
    const hc = league.coaches[staff.hc];
    const standing = league.standings[teamId];
    if (!hc || !standing) continue;
    const playoffResult = playoffOutcomeFor(league, teamId);
    hc.history.push({
      year: league.year, team: teamId, role: "HC",
      w: standing.w, l: standing.l, result: playoffResult,
    });
    hc.careerWins += standing.w;
    hc.careerLosses += standing.l;
    if (playoffResult === "Champion") hc.championships++;
    hc.yearsExperience++;
    hc.age++;
  }

  // 2) Award COY before firing — the best over-performer
  const coyId = pickCoachOfTheYear(league);
  if (coyId) {
    const coach = league.coaches[coyId];
    if (coach) {
      coach.cotyAwards++;
      const last = coach.history[coach.history.length - 1];
      if (last) last.coyAward = true;
      league.awards.push({
        year: league.year, type: "COY",
        playerId: "", team: coach.team!, position: "QB", coachId: coach.id,
      });
      league.news.unshift({
        id: `coy${league.year}`, year: league.year, week: 0, ts: Date.now(),
        category: "Award",
        headline: `Coach of the Year: ${coach.firstName} ${coach.lastName} (${TEAMS_BY_ID[coach.team!].name})`,
        teamId: coach.team!,
      });
    }
  }

  // 3) Retirements (age, low reputation)
  for (const c of Object.values(league.coaches)) {
    if (c.retired) continue;
    let retireChance = 0;
    if (c.age >= 70) retireChance = 0.6;
    else if (c.age >= 67) retireChance = 0.30;
    else if (c.age >= 64) retireChance = 0.10;
    // Long career & multiple championships boost retirement
    if (c.championships >= 2 && c.age >= 62) retireChance += 0.10;
    if (rng.chance(retireChance)) {
      retireCoach(league, c.id);
    }
  }

  // 4) HC firings — based on record + expectations
  for (const teamId of TEAMS.map((t) => t.id)) {
    const staff = league.staffs[teamId];
    if (!staff) continue;
    const hc = league.coaches[staff.hc];
    const standing = league.standings[teamId];
    if (!hc || !standing) continue;
    if (hc.retired) {
      // already gone; replace below
      replaceHC(league, teamId, rng);
      continue;
    }

    const wins = standing.w;
    const personality = personalityFor(teamId);
    const expectations = personality.rebuildBias === "WinNow" ? 10 : personality.rebuildBias === "Rebuild" ? 6 : 8;
    const shortfall = expectations - wins;

    let fireChance = 0;
    if (wins <= 3) fireChance = 0.7;
    else if (wins <= 5) fireChance = 0.45;
    else if (wins <= 7 && shortfall >= 2) fireChance = 0.20;
    else if (wins <= 8 && shortfall >= 3) fireChance = 0.12;

    // Coaches with championships get more leniency
    if (hc.championships > 0) fireChance *= 0.55;
    // Aggressive teams (LV, NYJ) fire faster
    if (personality.faStyle === "Aggressive" || personality.faStyle === "AllIn") fireChance *= 1.25;
    // Conservative teams (NE, GB, PIT) keep coaches longer
    if (personality.faStyle === "Conservative") fireChance *= 0.55;

    if (rng.chance(fireChance)) {
      fireCoach(league, hc.id, "Fired");
      replaceHC(league, teamId, rng);
    }
  }

  // 5) OC/DC turnover (some get promoted to HC elsewhere; some get reshuffled; ~12% per year)
  for (const teamId of TEAMS.map((t) => t.id)) {
    const staff = league.staffs[teamId];
    for (const role of ["oc", "dc"] as const) {
      const c = league.coaches[staff[role]];
      if (!c || c.retired) {
        // Replaced below
      }
      // 12% chance of departure (promoted/fired/retired/poached)
      if (c && !c.retired && rng.chance(0.12)) {
        // If high-quality coordinator, often gets HC interview → goes to FA pool
        const reputational = c.attrs.scheme + c.attrs.leadership;
        if (reputational >= 170 && rng.chance(0.4)) {
          // Promoted out of the role (will compete in HC market next year for now)
          c.team = null;
          league.coachFreeAgents.push(c.id);
          league.news.unshift({
            id: `coachmove${c.id}-${league.year}`,
            year: league.year, week: 0, ts: Date.now(),
            category: "League",
            headline: `${TEAMS_BY_ID[teamId].name} ${c.role} ${c.firstName} ${c.lastName} draws HC interest`,
            teamId,
          });
        } else {
          // Lateral move / dismissal
          fireCoach(league, c.id, "Fired");
        }
      }
    }
    // Replace any vacancies
    if (!league.coaches[staff.oc] || league.coaches[staff.oc].team !== teamId) {
      replaceCoordinator(league, teamId, "OC", rng);
    }
    if (!league.coaches[staff.dc] || league.coaches[staff.dc].team !== teamId) {
      replaceCoordinator(league, teamId, "DC", rng);
    }
  }

  // 6) Top up the FA pool with new coaches
  const need = Math.max(0, 25 - league.coachFreeAgents.length);
  for (let i = 0; i < need; i++) {
    const role = rng.weighted<CoachRole>(["HC", "OC", "DC"], [0.20, 0.40, 0.40]);
    const c = generateCoach({ role, rng });
    league.coaches[c.id] = c;
    league.coachFreeAgents.push(c.id);
  }
}

function playoffOutcomeFor(league: League, teamId: string): "Champion" | "Conf" | "Div" | "WC" | "Missed" {
  const champ = league.champions.find((c) => c.year === league.year);
  if (champ?.team === teamId) return "Champion";
  // Conference championship participants
  const cgs = league.schedule.filter((g) => g.year === league.year && g.week === 21 && g.played);
  for (const g of cgs) {
    if (g.home === teamId || g.away === teamId) return "Conf";
  }
  const dgs = league.schedule.filter((g) => g.year === league.year && g.week === 20 && g.played);
  for (const g of dgs) {
    if (g.home === teamId || g.away === teamId) return "Div";
  }
  const wcs = league.schedule.filter((g) => g.year === league.year && g.week === 19 && g.played);
  for (const g of wcs) {
    if (g.home === teamId || g.away === teamId) return "WC";
  }
  return "Missed";
}

function pickCoachOfTheYear(league: League): string | null {
  // Heuristic: HC of the team whose record most outperformed expected wins (based on prestige).
  // Tiebreak by W%
  let bestId: string | null = null;
  let bestScore = -999;
  for (const teamId of TEAMS.map((t) => t.id)) {
    const staff = league.staffs[teamId];
    const hc = staff && league.coaches[staff.hc];
    if (!hc) continue;
    const standing = league.standings[teamId];
    const team = TEAMS_BY_ID[teamId];
    const expected = (team.prestige - 60) * 0.45 + 4; // ~4..20 wins
    const overperform = standing.w - expected;
    const wp = (standing.w + standing.t * 0.5) / Math.max(standing.w + standing.l + standing.t, 1);
    const score = overperform * 2 + wp * 6;
    if (score > bestScore) {
      bestScore = score;
      bestId = hc.id;
    }
  }
  return bestId;
}

export function fireCoach(league: League, coachId: string, reason: "Fired" | "Resigned" = "Fired") {
  const c = league.coaches[coachId];
  if (!c) return;
  const prevTeam = c.team;
  c.team = null;
  if (prevTeam && c.history.length) {
    const last = c.history[c.history.length - 1];
    if (last.year === league.year && last.team === prevTeam) last.result = "Fired";
  }
  if (!league.coachFreeAgents.includes(coachId)) league.coachFreeAgents.push(coachId);
  if (prevTeam) {
    league.news.unshift({
      id: `firec${coachId}-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${TEAMS_BY_ID[prevTeam].name} part ways with ${c.role} ${c.firstName} ${c.lastName}`,
      teamId: prevTeam,
    });
  }
}

export function retireCoach(league: League, coachId: string) {
  const c = league.coaches[coachId];
  if (!c || c.retired) return;
  const prevTeam = c.team;
  c.retired = true;
  c.team = null;
  league.coachFreeAgents = league.coachFreeAgents.filter((id) => id !== coachId);
  if (prevTeam) {
    league.news.unshift({
      id: `retc${coachId}-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "Retire",
      headline: `${c.role} ${c.firstName} ${c.lastName} retires after ${c.history.length} seasons`,
      teamId: prevTeam,
    });
  }
}

function replaceHC(league: League, teamId: string, rng: RNG) {
  const staff = league.staffs[teamId];
  const team = TEAMS_BY_ID[teamId];
  const personality = personalityFor(teamId);
  const candidates = league.coachFreeAgents
    .map((id) => league.coaches[id])
    .filter((c) => !!c && !c.retired);

  // Prefer HCs in the FA pool; if scarce, promote a coordinator
  const hcCandidates = candidates.filter((c) => c.role === "HC");
  const ocPromote = candidates.filter((c) => c.role === "OC" && c.attrs.scheme >= 78);
  const dcPromote = candidates.filter((c) => c.role === "DC" && c.attrs.scheme >= 78);
  const pool = [...hcCandidates, ...ocPromote, ...dcPromote];

  // Score by reputation + scheme + personality fit
  const scored = pool.map((c) => {
    const reputationScore = c.reputation;
    const schemeMatch = (c.offenseScheme === team.offenseScheme ? 5 : 0) +
                         (c.defenseScheme === team.defenseScheme ? 5 : 0);
    // Aggressive front offices like aggressive coaches
    const aggBonus = personality.faStyle === "Aggressive" || personality.faStyle === "AllIn"
      ? c.fourthDownAgg * 10 : 0;
    return { c, score: reputationScore + schemeMatch + aggBonus };
  }).sort((a, b) => b.score - a.score);

  if (!scored.length) {
    // Generate a fresh coach
    const fresh = generateCoach({ role: "HC", rng, tier: pickTierFromPrestige(team.prestige, rng) });
    league.coaches[fresh.id] = fresh;
    scored.push({ c: fresh, score: 999 });
  }

  const choice = scored[0].c;
  // Promote role to HC if needed
  if (choice.role !== "HC") {
    choice.role = "HC";
    if (!choice.offenseScheme) choice.offenseScheme = team.offenseScheme;
    if (!choice.defenseScheme) choice.defenseScheme = team.defenseScheme;
    // Add fourthDownAgg / tempo if missing
  }
  choice.team = teamId;
  league.coachFreeAgents = league.coachFreeAgents.filter((id) => id !== choice.id);
  staff.hc = choice.id;

  league.news.unshift({
    id: `hirec${choice.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `${TEAMS_BY_ID[teamId].name} hire ${choice.firstName} ${choice.lastName} as new head coach`,
    teamId,
  });
}

function replaceCoordinator(league: League, teamId: string, role: "OC" | "DC", rng: RNG) {
  const staff = league.staffs[teamId];
  const team = TEAMS_BY_ID[teamId];
  const candidates = league.coachFreeAgents
    .map((id) => league.coaches[id])
    .filter((c) => !!c && !c.retired && (c.role === role || c.role === "HC"));

  let choice: Coach;
  if (candidates.length) {
    candidates.sort((a, b) => b.reputation + (b.role === role ? 10 : 0) - (a.reputation + (a.role === role ? 10 : 0)));
    choice = candidates[0];
    // If they were a HC, demote them to coordinator (rare but happens)
    if (choice.role !== role) choice.role = role;
  } else {
    choice = generateCoach({ role, rng });
    league.coaches[choice.id] = choice;
  }
  choice.team = teamId;
  league.coachFreeAgents = league.coachFreeAgents.filter((id) => id !== choice.id);
  if (role === "OC") staff.oc = choice.id;
  else staff.dc = choice.id;

  league.news.unshift({
    id: `hire${role}${choice.id}-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `${TEAMS_BY_ID[teamId].name} name ${choice.firstName} ${choice.lastName} ${role}`,
    teamId,
  });
}

// =====================================================================
// Helpers used by sim & UI
// =====================================================================

export function staffOf(league: League, teamId: string): { hc?: Coach; oc?: Coach; dc?: Coach } {
  const staff = league.staffs?.[teamId];
  if (!staff) return {};
  return {
    hc: league.coaches[staff.hc],
    oc: league.coaches[staff.oc],
    dc: league.coaches[staff.dc],
  };
}

/** Use this before reading league.staffs/coaches to ensure presence. Older saves may lack these. */
export function ensureCoachesExist(league: League): boolean {
  if (league.staffs && Object.keys(league.staffs).length > 0) return true;
  return false;
}
