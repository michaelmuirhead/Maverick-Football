import { RNG } from "@/lib/rng";
import type {
  JobOffer, League, UserCareer, UserCareerStint, UserMode,
} from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { personalityFor } from "./personalities";
import { computeTeamPhase } from "./strategy";
import { staffOf } from "./coaches";
import { teamOvr } from "@/lib/gen/roster";
import { clamp } from "@/lib/utils";

// =====================================================================
// User career: 3 modes (Owner / GM / HC), evaluation, hot-seat, firing,
// job market and offers, retirement.
// =====================================================================

export type Capability =
  | "trades" | "freeAgency" | "draft" | "contracts"
  | "rosterOps" | "scouting"
  | "depthChart" | "gamePlans"
  | "fireStaff";

const CAPS: Record<UserMode, Capability[]> = {
  Owner: ["trades", "freeAgency", "draft", "contracts", "rosterOps", "scouting", "depthChart", "gamePlans", "fireStaff"],
  GM:    ["trades", "freeAgency", "draft", "contracts", "rosterOps", "scouting"],
  HC:    ["depthChart", "gamePlans"],
};

export function userMode(league: League | null | undefined): UserMode {
  return league?.userMode ?? "Owner";
}

export function userCan(league: League | null | undefined, cap: Capability): boolean {
  if (!league) return false;
  // If user has been fired or is sitting a year, they can't do team ops
  if (league.userCareer && (league.userCareer.status === "Fired" || league.userCareer.status === "TakingYearOff" || league.userCareer.status === "Retired")) return false;
  return CAPS[userMode(league)].includes(cap);
}

export function describeMode(m: UserMode): string {
  switch (m) {
    case "Owner": return "Owner — full control, never fired. Sets franchise direction.";
    case "GM":    return "General Manager — roster decisions: trades, FA, draft, contracts. Coach handles game day.";
    case "HC":    return "Head Coach — depth chart, game plans, sideline. GM handles the roster.";
  }
}

// =====================================================================
// Initial career setup
// =====================================================================

export function buildInitialCareer(mode: UserMode, teamId: string, year: number): UserCareer {
  const stints: UserCareerStint[] = [];
  if (mode !== "Owner") {
    stints.push({
      team: teamId, role: mode, startYear: year,
      wins: 0, losses: 0, playoffApps: 0, championships: 0,
      awards: [],
    });
  }
  return {
    mode,
    reputation: 70,
    team: teamId,
    contractYears: mode === "Owner" ? 99 : 4,
    contractSalary: mode === "Owner" ? 0 : mode === "HC" ? 8 : 6,
    status: "Active",
    stints,
  };
}

// =====================================================================
// Year-end evaluation (run during advanceOffseason BEFORE other steps).
// =====================================================================

export function evaluateUserSeason(league: League): {
  fired: boolean; hotSeat: boolean; reasons: string[];
} {
  const career = league.userCareer;
  if (!career) return { fired: false, hotSeat: false, reasons: [] };
  if (career.mode === "Owner") return { fired: false, hotSeat: false, reasons: [] };
  if (!career.team) return { fired: false, hotSeat: false, reasons: [] };
  if (career.status !== "Active" && career.status !== "OnHotSeat") {
    return { fired: false, hotSeat: false, reasons: [] };
  }

  const team = TEAMS_BY_ID[career.team];
  const standing = league.standings[career.team];
  const personality = personalityFor(career.team);
  const expectedWins =
    personality.rebuildBias === "WinNow" ? 10 :
    personality.rebuildBias === "Rebuild" ? 6 : 8;
  const wins = standing.w;
  const playedPlayoff = league.schedule.some(
    (g) => g.year === league.year && g.week === 19 && g.played &&
    (g.home === career.team || g.away === career.team),
  );
  const wonChampionship = league.champions.some(
    (c) => c.year === league.year && c.team === career.team,
  );

  // Update current stint stats
  const stint = career.stints[career.stints.length - 1];
  if (stint && !stint.endYear) {
    stint.wins += wins;
    stint.losses += standing.l;
    if (playedPlayoff) stint.playoffApps += 1;
    if (wonChampionship) stint.championships += 1;
  }

  // Reputation update
  let repDelta = 0;
  repDelta += (wins - expectedWins) * 1.4;
  if (playedPlayoff) repDelta += 4;
  if (wonChampionship) repDelta += 12;
  if (career.mode === "GM") {
    // GM judged also by team quality + cap + draft (proxy: team ovr trend; we use teamOvr now)
    const ovr = teamOvr(league, career.team);
    if (ovr >= 82) repDelta += 2;
    else if (ovr <= 70) repDelta -= 2;
  }
  career.reputation = clamp(Math.round(career.reputation + repDelta), 35, 99);

  // Decrement contract
  career.contractYears = Math.max(0, career.contractYears - 1);

  // Decide hot seat / firing
  const reasons: string[] = [];
  let fireScore = 0;
  if (wins <= 3) fireScore += 0.7;
  else if (wins <= 5) fireScore += 0.4;
  else if (wins <= expectedWins - 3) fireScore += 0.25;
  if (career.reputation < 50) fireScore += 0.30;
  if (career.reputation < 40) fireScore += 0.30;
  if (career.status === "OnHotSeat") fireScore += 0.20;
  // Champions and recent winners get protection
  const recentChamps = (stint?.championships ?? 0) >= 1;
  if (recentChamps) fireScore -= 0.40;
  // Conservative ownership keeps coaches longer
  if (personality.faStyle === "Conservative") fireScore *= 0.6;
  if (personality.faStyle === "Aggressive" || personality.faStyle === "AllIn") fireScore *= 1.25;

  let fired = false;
  let hotSeat = false;
  if (fireScore >= 0.65) {
    fired = true;
    reasons.push(wins <= 5 ? `${wins}-${standing.l} record` : "missed expectations");
    if (career.reputation < 50) reasons.push(`reputation ${career.reputation}`);
  } else if (fireScore >= 0.4) {
    hotSeat = true;
    reasons.push(wins < expectedWins ? `${wins} wins (expected ${expectedWins})` : "performance under review");
  }

  if (fired) {
    career.status = "Fired";
    career.fireYear = league.year;
    if (stint && !stint.endYear) {
      stint.endYear = league.year;
      stint.fired = true;
      stint.reason = reasons.join("; ");
    }
    career.team = null;
    league.news.unshift({
      id: `userfired-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${TEAMS_BY_ID[team.id].name} fire their ${career.mode === "GM" ? "general manager" : "head coach"} after ${reasons.join("; ")}`,
      teamId: team.id,
    });
  } else if (hotSeat) {
    career.status = "OnHotSeat";
    career.hotSeatReason = reasons.join("; ");
    league.news.unshift({
      id: `userhotseat-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${TEAMS_BY_ID[team.id].name} ownership puts ${career.mode} on the hot seat — ${reasons.join("; ")}`,
      teamId: team.id,
    });
  } else {
    career.status = "Active";
    career.hotSeatReason = undefined;
  }

  // Auto-extend if contract just hit zero and not fired
  if (!fired && career.contractYears <= 0) {
    career.contractYears = 3;
    career.contractSalary = Math.round(career.contractSalary * (career.reputation >= 80 ? 1.30 : career.reputation >= 70 ? 1.10 : 0.90) * 10) / 10;
    league.news.unshift({
      id: `userext-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${TEAMS_BY_ID[team.id].name} extend ${career.mode} — 3yr / $${career.contractSalary.toFixed(1)}M`,
      teamId: team.id,
    });
  }

  return { fired, hotSeat, reasons };
}

// =====================================================================
// Job market — generate offers when user is fired or sitting out.
// =====================================================================

export function generateJobOffers(league: League) {
  const career = league.userCareer;
  if (!career) return;
  if (career.mode === "Owner") return;
  if (career.status !== "Fired" && career.status !== "TakingYearOff") return;

  const rng = new RNG(`offers:${league.year}:${career.reputation}`);

  // Identify openings: teams that just fired their HC (or GM in this game's simplification).
  // For HC mode, find teams whose HC was just fired in the current carousel — recent hire/fire news;
  // simpler: any team can offer if their record was bad last year. We pick from worst-W% teams.
  const openings = TEAMS.map((t) => {
    const s = league.standings[t.id];
    const wp = (s.w + s.t * 0.5) / Math.max(s.w + s.l + s.t, 1);
    const personality = personalityFor(t.id);
    return { t, wp, personality };
  });

  // Number of offers based on reputation
  const baseOffers =
    career.reputation >= 85 ? 4 :
    career.reputation >= 75 ? 3 :
    career.reputation >= 65 ? 2 :
    career.reputation >= 55 ? 1 : 0;

  // Sort potential employers — bad teams hire first; aggressive personalities like name-brand candidates
  const ranked = openings.sort((a, b) => {
    let scoreA = (1 - a.wp) * 5;
    let scoreB = (1 - b.wp) * 5;
    if (a.personality.faStyle === "Aggressive" || a.personality.faStyle === "AllIn") scoreA += 2;
    if (b.personality.faStyle === "Aggressive" || b.personality.faStyle === "AllIn") scoreB += 2;
    return scoreB - scoreA;
  });

  const newOffers: JobOffer[] = [];
  for (let i = 0; i < ranked.length && newOffers.length < baseOffers; i++) {
    const t = ranked[i].t;
    if (t.id === career.team) continue;
    // Don't double-offer
    if (league.jobOffers.some((o) => o.team === t.id && o.role === career.mode)) continue;

    // Hire chance based on reputation vs randomness
    if (!rng.chance(clamp(career.reputation / 100, 0.3, 0.95))) continue;

    const personality = personalityFor(t.id);
    const expectations =
      personality.rebuildBias === "WinNow" ? "WinNow" :
      personality.rebuildBias === "Rebuild" ? "Rebuild" : "Balanced";
    const baseSalary = career.mode === "HC" ? 8 : 6;
    const repBonus = (career.reputation - 70) * 0.15;
    const salary = Math.max(2, Math.round((baseSalary + repBonus + rng.float(-1, 1)) * 10) / 10);
    const years = clamp(Math.round(rng.normal(4, 0.8)), 2, 5);

    newOffers.push({
      id: `off-${t.id}-${league.year}-${career.mode}`,
      team: t.id,
      role: career.mode,
      years,
      salary,
      expectations,
      postedYear: league.year,
    });
  }

  league.jobOffers = newOffers;

  // Announce offer count
  if (newOffers.length > 0) {
    league.news.unshift({
      id: `offers-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `${newOffers.length} team${newOffers.length === 1 ? "" : "s"} interested in your services`,
    });
  } else {
    league.news.unshift({
      id: `nooffers-${league.year}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `No teams have made offers — consider taking a year off to rebuild your reputation`,
    });
  }
}

// =====================================================================
// User actions
// =====================================================================

export function acceptJobOffer(league: League, offerId: string): { ok: boolean; reason?: string } {
  const career = league.userCareer;
  if (!career) return { ok: false, reason: "No career" };
  const offer = league.jobOffers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, reason: "Offer not found" };

  career.team = offer.team;
  career.contractYears = offer.years;
  career.contractSalary = offer.salary;
  career.status = "Active";
  career.fireYear = undefined;
  career.hotSeatReason = undefined;
  career.stints.push({
    team: offer.team,
    role: career.mode,
    startYear: league.year,
    wins: 0, losses: 0, playoffApps: 0, championships: 0,
    awards: [],
  });
  league.userTeam = offer.team;
  league.jobOffers = [];

  league.news.unshift({
    id: `userhired-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `${TEAMS_BY_ID[offer.team].name} hire new ${career.mode === "GM" ? "general manager" : "head coach"} — ${offer.years}yr / $${offer.salary.toFixed(1)}M`,
    teamId: offer.team,
  });
  return { ok: true };
}

export function takeYearOff(league: League): { ok: boolean; reason?: string } {
  const career = league.userCareer;
  if (!career) return { ok: false, reason: "No career" };
  if (career.status !== "Fired") return { ok: false, reason: "Not currently a free agent" };
  career.status = "TakingYearOff";
  // Slight reputation rebound
  career.reputation = clamp(career.reputation + 3, 40, 99);
  league.jobOffers = [];
  league.news.unshift({
    id: `userrest-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `Took a year off to recalibrate. Job market reopens next offseason.`,
  });
  return { ok: true };
}

export function retireFromCareer(league: League): { ok: boolean; reason?: string } {
  const career = league.userCareer;
  if (!career) return { ok: false, reason: "No career" };
  career.status = "Retired";
  league.jobOffers = [];
  league.news.unshift({
    id: `userretire-${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "Retire",
    headline: `Retired from ${career.mode === "GM" ? "general manager work" : "coaching"} after ${career.stints.length} stint${career.stints.length === 1 ? "" : "s"}.`,
  });
  return { ok: true };
}
