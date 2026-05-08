import { RNG } from "@/lib/rng";
import type {
  Coach, DefenseEmphasis, GamePlan, League, OffenseEmphasis, TempoChoice,
} from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { personalityFor } from "./personalities";
import { staffOf } from "./coaches";
import { teamSimRatings } from "@/lib/gen/roster";
import { clamp } from "@/lib/utils";

// =====================================================================
// Game plans + the unified coaching-mods helper used by the sim engines.
// =====================================================================

export const OFFENSE_EMPHASIS_OPTIONS: { id: OffenseEmphasis; label: string; desc: string }[] = [
  { id: "HeavyRun",   label: "Heavy Run",       desc: "Pound the rock, control tempo. Boosts RB workload and run yards." },
  { id: "Balanced",   label: "Balanced",        desc: "Standard NFL distribution. No bias either way." },
  { id: "SpreadBall", label: "Spread the Ball", desc: "Multiple receivers eat — flat target distribution, fewer big plays." },
  { id: "AirItOut",   label: "Air It Out",      desc: "Vertical attack. Big plays up, but pass-heavy and turnover-prone." },
];

export const DEFENSE_EMPHASIS_OPTIONS: { id: DefenseEmphasis; label: string; desc: string }[] = [
  { id: "StopRun",      label: "Stop the Run",   desc: "Stack the box. Tougher run defense, but coverage cracks." },
  { id: "Pressure",     label: "Bring Pressure", desc: "Blitz-heavy. More sacks, but more big plays surrendered." },
  { id: "DropCoverage", label: "Drop in Coverage", desc: "Soft shell. Tighter passing windows, fewer sacks." },
  { id: "Balanced",     label: "Balanced",       desc: "Mix it up — no extreme tendencies." },
];

export const TEMPO_OPTIONS: { id: TempoChoice; label: string; desc: string }[] = [
  { id: "Slow",     label: "Slow",     desc: "Burn clock. Fewer drives, fewer points overall." },
  { id: "Balanced", label: "Balanced", desc: "Standard rhythm." },
  { id: "Hurry",    label: "Hurry-Up", desc: "Push the pace. More drives, more points (both ways)." },
];

export function planKey(gameId: string, teamId: string): string {
  return `${gameId}-${teamId}`;
}

export function getGamePlan(league: League, gameId: string, teamId: string): GamePlan | undefined {
  return league.gamePlans?.[planKey(gameId, teamId)];
}

export function setGamePlan(league: League, plan: GamePlan): void {
  if (!league.gamePlans) league.gamePlans = {};
  league.gamePlans[planKey(plan.gameId, plan.teamId)] = plan;
}

/** Auto-generate a sensible plan for a CPU team given coach + matchup. */
export function autoGenerateCpuPlan(
  league: League, gameId: string, teamId: string, opponentId: string,
): GamePlan {
  const rng = new RNG(`plan:${gameId}:${teamId}`);
  const personality = personalityFor(teamId);
  const { hc, oc, dc } = staffOf(league, teamId);
  const team = TEAMS_BY_ID[teamId];

  // Offensive emphasis biased by scheme + OC strengths
  const offScheme = oc?.offenseScheme ?? team.offenseScheme;
  let offEmphasis: OffenseEmphasis;
  if (offScheme === "Air Raid") {
    offEmphasis = rng.weighted<OffenseEmphasis>(["AirItOut", "Balanced", "SpreadBall"], [0.55, 0.30, 0.15]);
  } else if (offScheme === "Power Run") {
    offEmphasis = rng.weighted<OffenseEmphasis>(["HeavyRun", "Balanced", "AirItOut"], [0.55, 0.35, 0.10]);
  } else if (offScheme === "Spread") {
    offEmphasis = rng.weighted<OffenseEmphasis>(["AirItOut", "SpreadBall", "Balanced"], [0.40, 0.30, 0.30]);
  } else if (offScheme === "Pro Style") {
    offEmphasis = rng.weighted<OffenseEmphasis>(["Balanced", "HeavyRun", "AirItOut"], [0.55, 0.25, 0.20]);
  } else {
    offEmphasis = rng.weighted<OffenseEmphasis>(["Balanced", "AirItOut", "SpreadBall"], [0.45, 0.35, 0.20]);
  }

  // Defensive emphasis biased by DC blitz preference
  const blitz = dc?.attrs.blitz ?? 70;
  let defEmphasis: DefenseEmphasis;
  if (blitz >= 82) defEmphasis = rng.weighted(["Pressure", "Balanced", "StopRun"], [0.55, 0.25, 0.20]);
  else if (blitz <= 60) defEmphasis = rng.weighted(["DropCoverage", "Balanced", "StopRun"], [0.50, 0.30, 0.20]);
  else defEmphasis = rng.weighted(["Balanced", "Pressure", "StopRun", "DropCoverage"], [0.40, 0.25, 0.20, 0.15]);

  // Counter the opponent's tendencies if they're extreme
  const oppOff = TEAMS_BY_ID[opponentId].offenseScheme;
  if (oppOff === "Power Run" && rng.chance(0.4)) defEmphasis = "StopRun";
  if ((oppOff === "Air Raid" || oppOff === "Spread") && rng.chance(0.35)) defEmphasis = "Pressure";

  // Tempo from HC tempo
  const tempoVal = hc?.tempo ?? personality.tempo;
  let tempo: TempoChoice;
  if (tempoVal >= 0.65) tempo = rng.weighted(["Hurry", "Balanced", "Slow"], [0.55, 0.35, 0.10]);
  else if (tempoVal <= 0.40) tempo = rng.weighted(["Slow", "Balanced", "Hurry"], [0.45, 0.40, 0.15]);
  else tempo = rng.weighted(["Balanced", "Hurry", "Slow"], [0.55, 0.25, 0.20]);

  return {
    gameId, teamId,
    offEmphasis, defEmphasis, tempo,
    byUser: false,
  };
}

export function ensureGamePlan(
  league: League, gameId: string, teamId: string, opponentId: string,
): GamePlan {
  const existing = getGamePlan(league, gameId, teamId);
  if (existing) return existing;
  const plan = autoGenerateCpuPlan(league, gameId, teamId, opponentId);
  setGamePlan(league, plan);
  return plan;
}

// =====================================================================
// Sim modifier vector — the unified output the engines consume.
// Each scalar is a small additive/multiplicative shift on a sim parameter.
// =====================================================================

export interface CoachingMods {
  /** -0.30..+0.30 added to base pass probability */
  passBias: number;
  /** 0..1 — drives 4th-down go-for-it logic */
  fourthDownAgg: number;
  /** 0..1 — defensive blitz aggressiveness */
  blitzRate: number;
  /** 0.85..1.15 — multiplier on rushing yards/play */
  rushYpcMult: number;
  /** 0.85..1.15 — multiplier on completion %. */
  completionMult: number;
  /** 0..0.05 — bonus chance of a big play (offense) */
  bigPlayBonus: number;
  /** 0..0.04 — bonus chance defense surrenders a big play */
  bigPlayConcedeBonus: number;
  /** -0.06..+0.06 — sack chance modifier (offense side: protection) */
  protectionMod: number;
  /** -0.06..+0.06 — interception chance modifier (offense side: ball security) */
  interceptionMod: number;
  /** 0.85..1.15 — drive-time multiplier (slow burn or hurry-up) */
  driveTimeMult: number;
  /** Featured player id — biased target on offense */
  featuredPlayerId?: string;
  /** Shadow player id — opponent gets fewer touches when shadowed by you */
  shadowPlayerId?: string;
}

/**
 * Compute the offensive coaching mods for `teamId` when they are on offense.
 * `gameId` is optional — when present, the team's game plan applies.
 * `opponentId` is needed for the defensive mods if a game plan applies.
 */
export function offensiveMods(
  league: League, teamId: string, gameId?: string,
): CoachingMods {
  const personality = personalityFor(teamId);
  const team = TEAMS_BY_ID[teamId];
  const { hc, oc } = staffOf(league, teamId);

  // Coaching base
  let passBias = personality.passBias;
  let fourthDownAgg = personality.fourthDownAggression;
  let bigPlayBonus = 0;
  let interceptionMod = 0;
  let protectionMod = 0;
  let rushYpcMult = 1.0;
  let completionMult = 1.0;
  let driveTimeMult = 1.0;
  let bigPlayConcedeBonus = 0;

  if (oc) {
    const passBalance = ((oc.attrs.passing ?? 70) - (oc.attrs.rushing ?? 70)) / 100; // ±0.3
    passBias = clamp(passBias * 0.4 + passBalance * 0.10, -0.20, 0.20);
    completionMult *= 1 + ((oc.attrs.passing ?? 70) - 70) * 0.0035;
    rushYpcMult *= 1 + ((oc.attrs.rushing ?? 70) - 70) * 0.0035;
    bigPlayBonus += clamp(((oc.attrs.scheme - 70) / 100) * 0.025, 0, 0.025);
    interceptionMod -= clamp(((oc.attrs.scheme - 70) / 100) * 0.015, 0, 0.025);
  }

  // Scheme baked into team data also nudges
  const offScheme = oc?.offenseScheme ?? team.offenseScheme;
  if (offScheme === "Air Raid") { passBias += 0.06; bigPlayBonus += 0.01; interceptionMod += 0.005; }
  else if (offScheme === "Spread") passBias += 0.03;
  else if (offScheme === "Power Run") { passBias -= 0.06; rushYpcMult *= 1.04; }

  if (hc) {
    fourthDownAgg = clamp(personality.fourthDownAggression * 0.4 + hc.fourthDownAgg * 0.6, 0, 1);
    driveTimeMult *= 1 + (hc.tempo - 0.5) * -0.10; // higher tempo = less drive time
  }

  // Apply user/CPU game plan
  let featuredPlayerId: string | undefined;
  let shadowPlayerId: string | undefined;

  if (gameId && league.gamePlans) {
    const plan = getGamePlan(league, gameId, teamId);
    if (plan) {
      switch (plan.offEmphasis) {
        case "HeavyRun":
          passBias -= 0.10; rushYpcMult *= 1.06; driveTimeMult *= 1.05;
          break;
        case "AirItOut":
          passBias += 0.10; bigPlayBonus += 0.02; interceptionMod += 0.005;
          break;
        case "SpreadBall":
          passBias += 0.02; bigPlayBonus -= 0.005;
          break;
        case "Balanced":
        default:
          break;
      }
      switch (plan.tempo) {
        case "Slow":   driveTimeMult *= 1.20; break;
        case "Hurry":  driveTimeMult *= 0.78; break;
      }
      featuredPlayerId = plan.featuredPlayer;
      shadowPlayerId = plan.shadowPlayer;
    }
  }

  return {
    passBias: clamp(passBias, -0.30, 0.30),
    fourthDownAgg,
    blitzRate: 0,        // offense doesn't use this
    rushYpcMult: clamp(rushYpcMult, 0.80, 1.20),
    completionMult: clamp(completionMult, 0.85, 1.18),
    bigPlayBonus: clamp(bigPlayBonus, 0, 0.08),
    bigPlayConcedeBonus: 0,
    protectionMod,
    interceptionMod: clamp(interceptionMod, -0.04, 0.04),
    driveTimeMult: clamp(driveTimeMult, 0.65, 1.30),
    featuredPlayerId,
    shadowPlayerId,
  };
}

/**
 * Compute defensive coaching mods for `teamId` when they are on defense.
 */
export function defensiveMods(
  league: League, teamId: string, gameId?: string,
): CoachingMods {
  const personality = personalityFor(teamId);
  const { dc } = staffOf(league, teamId);

  let blitzRate = personality.blitzRate;
  let rushYpcMult = 1.0;       // run-D effect: lower = better against run
  let completionMult = 1.0;    // pass-D effect: lower = better against pass
  let bigPlayConcedeBonus = 0;
  let bigPlayBonus = 0;

  if (dc) {
    blitzRate = clamp((personality.blitzRate * 0.4) + ((dc.attrs.blitz ?? 70) / 100) * 0.6, 0, 1);
    completionMult *= 1 - ((dc.attrs.coverage ?? 70) - 70) * 0.0035;
    rushYpcMult *= 1 - ((dc.attrs.scheme - 70) / 100) * 0.020;
  }

  // Game plan
  let featuredPlayerId: string | undefined;
  let shadowPlayerId: string | undefined;
  if (gameId && league.gamePlans) {
    const plan = getGamePlan(league, gameId, teamId);
    if (plan) {
      switch (plan.defEmphasis) {
        case "StopRun":
          rushYpcMult *= 0.92;        // tighter run defense
          completionMult *= 1.05;     // softer pass defense
          break;
        case "Pressure":
          blitzRate = clamp(blitzRate + 0.12, 0, 1);
          bigPlayConcedeBonus += 0.018;
          break;
        case "DropCoverage":
          blitzRate = clamp(blitzRate - 0.10, 0, 1);
          completionMult *= 0.95;     // tighter pass defense
          break;
      }
      shadowPlayerId = plan.shadowPlayer;
    }
  }

  return {
    passBias: 0,
    fourthDownAgg: 0,
    blitzRate,
    rushYpcMult: clamp(rushYpcMult, 0.75, 1.25),
    completionMult: clamp(completionMult, 0.85, 1.18),
    bigPlayBonus,
    bigPlayConcedeBonus: clamp(bigPlayConcedeBonus, 0, 0.05),
    protectionMod: 0,
    interceptionMod: 0,
    driveTimeMult: 1.0,
    featuredPlayerId,
    shadowPlayerId,
  };
}

/** Convenience for the live engine: get HC's go-for-it threshold. */
export function fourthDownAggressionFor(league: League, teamId: string): number {
  return offensiveMods(league, teamId).fourthDownAgg;
}
