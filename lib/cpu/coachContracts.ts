import { RNG } from "@/lib/rng";
import type { Coach, CoachContract, League } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { clamp } from "@/lib/utils";

// =====================================================================
// Coach contracts: years, salary, auto-extensions, fire-with-buyout.
// Layered on top of the existing carousel.
// =====================================================================

const HC_BASE_SALARY = 8;       // $M / yr
const OC_BASE_SALARY = 3;
const DC_BASE_SALARY = 3;
const HC_MAX_SALARY = 18;
const HC_MIN_SALARY = 4;

function baseSalaryFor(role: Coach["role"]): number {
  return role === "HC" ? HC_BASE_SALARY : role === "OC" ? OC_BASE_SALARY : DC_BASE_SALARY;
}

/** Compute a market salary based on role + reputation + championships. */
export function marketSalary(coach: Coach): number {
  const base = baseSalaryFor(coach.role);
  const repFactor = 0.6 + (coach.reputation / 100) * 1.0;     // 0.6..1.6
  const champBonus = coach.championships * 0.25;              // +0.25 per ring
  const cotyBonus = coach.cotyAwards * 0.15;
  const ageDrag = coach.age >= 65 ? 0.85 : coach.age >= 60 ? 0.95 : 1.0;
  const computed = base * repFactor * (1 + champBonus + cotyBonus) * ageDrag;
  return Math.round(clamp(computed, HC_MIN_SALARY * (coach.role === "HC" ? 1 : 0.4), HC_MAX_SALARY * (coach.role === "HC" ? 1 : 0.5)) * 10) / 10;
}

/** Initialize a contract for a coach who doesn't have one yet. */
export function ensureContract(league: League, coachId: string, signedYear: number, years = 4): CoachContract {
  league.coachContracts = league.coachContracts ?? {};
  if (league.coachContracts[coachId]) return league.coachContracts[coachId];
  const coach = league.coaches[coachId];
  if (!coach || !coach.team) {
    return league.coachContracts[coachId] = {
      coachId, team: coach?.team ?? "",
      years, salary: marketSalary(coach!),
      signedYear,
    };
  }
  const contract: CoachContract = {
    coachId,
    team: coach.team,
    years,
    salary: marketSalary(coach),
    signedYear,
  };
  league.coachContracts[coachId] = contract;
  return contract;
}

/** Assign default contracts to every coach that doesn't have one yet. */
export function ensureAllContracts(league: League) {
  for (const coach of Object.values(league.coaches)) {
    if (!coach.team) continue;
    ensureContract(league, coach.id, league.year);
  }
}

/** Run end-of-year contract logic: decrement, auto-extend if performing, expire to FA. */
export function advanceCoachContracts(league: League) {
  league.coachContracts = league.coachContracts ?? {};
  for (const coach of Object.values(league.coaches)) {
    if (coach.retired) continue;
    const c = league.coachContracts[coach.id];
    if (!c) continue;
    c.years -= 1;
    if (c.years <= 0) {
      // Decision: extend if performing, otherwise let walk
      const recentSeason = coach.history[coach.history.length - 1];
      const wins = recentSeason?.w ?? 0;
      const playoff = recentSeason?.result && recentSeason.result !== "Missed" && recentSeason.result !== "Fired";
      const championship = recentSeason?.result === "Champion";

      let extendChance = 0.4;
      if (championship) extendChance = 0.95;
      else if (playoff) extendChance = 0.7;
      else if (wins >= 9) extendChance = 0.55;
      else if (wins <= 5) extendChance = 0.15;

      // Use deterministic-ish probability from a coach-id seed
      const seed = `coachext:${coach.id}:${league.year}`;
      let h = 2166136261;
      for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
      const r = (h >>> 0) / 4294967296;

      if (r < extendChance) {
        c.years = 4;
        c.salary = marketSalary(coach);
        c.signedYear = league.year;
        league.news.unshift({
          id: `coachext-${coach.id}-${league.year}`,
          year: league.year, week: 0, ts: Date.now(),
          category: "League",
          headline: `${TEAMS_BY_ID[coach.team!]?.name ?? coach.team} extend ${coach.role} ${coach.firstName} ${coach.lastName} — 4yr / $${c.salary.toFixed(1)}M`,
          teamId: coach.team!,
        });
      } else {
        // Contract expires; coach becomes FA, team reposted
        const prevTeam = coach.team;
        coach.team = null;
        delete league.coachContracts[coach.id];
        if (!league.coachFreeAgents.includes(coach.id)) league.coachFreeAgents.push(coach.id);
        if (prevTeam) {
          league.news.unshift({
            id: `coachexp-${coach.id}-${league.year}`,
            year: league.year, week: 0, ts: Date.now(),
            category: "League",
            headline: `${TEAMS_BY_ID[prevTeam]?.name ?? prevTeam} let ${coach.role} ${coach.firstName} ${coach.lastName}'s contract expire`,
            teamId: prevTeam,
          });
        }
      }
    }
  }
}

/** Cost of firing a coach mid-contract (buyout). */
export function fireBuyout(league: League, coachId: string): number {
  const c = league.coachContracts?.[coachId];
  if (!c) return 0;
  // Buyout is half remaining years' salary
  return Math.round(c.salary * c.years * 0.5 * 10) / 10;
}

/** Total annual coaching staff payroll for a team. */
export function staffPayroll(league: League, teamId: string): number {
  let total = 0;
  for (const c of Object.values(league.coachContracts ?? {})) {
    if (c.team === teamId) total += c.salary;
  }
  return Math.round(total * 10) / 10;
}

/** All unemployed coaches (FA market). */
export function coachMarket(league: League): Coach[] {
  return (league.coachFreeAgents ?? [])
    .map((id) => league.coaches[id])
    .filter((c): c is Coach => !!c && !c.retired);
}
