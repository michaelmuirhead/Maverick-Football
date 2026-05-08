import type { Position } from "@/lib/types";

// =====================================================================
// Front-office and coaching personalities for each franchise. These are
// flavor archetypes loosely modeled on each club's recent reputation —
// they shape how the CPU drafts, signs, spends, and calls plays.
// All numbers are dimensionless modifiers; sensible ranges are noted.
// =====================================================================

export type DraftStyle =
  | "BPA"            // best player available, ignore positional fit somewhat
  | "Need"           // fill gaps first
  | "Trenches"       // weight OL/DL heavily
  | "Skill"          // weight QB/WR/RB/TE
  | "BoomBust"       // chase potential, accept misses
  | "Safe";          // prefer high-floor over high-ceiling

export type FAStyle =
  | "Aggressive"     // overpay for stars
  | "Balanced"
  | "Conservative"   // disciplined, won't overpay
  | "Bargain"        // hunt for value, low-tier signings only
  | "AllIn";         // mortgage cap to win now

export type RebuildBias = "WinNow" | "Balanced" | "Rebuild";

export interface Personality {
  draftStyle: DraftStyle;
  faStyle: FAStyle;
  rebuildBias: RebuildBias;

  /** 0..1 — how much they swing for upside vs floor */
  riskTolerance: number;
  /** 0..1 — fidelity of scout grades to true ovr/pot. Higher = better drafts */
  scoutAccuracy: number;

  // ---- Coaching modifiers applied to live sim ----
  /** -0.18..+0.18 added to base pass probability */
  passBias: number;
  /** 0..1 — bumps 4th-down go-for-it thresholds */
  fourthDownAggression: number;
  /** 0..1 — extra sack pressure but slightly more big plays allowed */
  blitzRate: number;
  /** 0..1 — preference for tempo/pace (informational only for now) */
  tempo: number;

  // ---- Roster construction biases ----
  /** Multiplier on need scoring per position group. >1 = priority. */
  positionValueMods: Partial<Record<"QB"|"RB"|"WR"|"TE"|"OL"|"DL"|"LB"|"DB"|"ST", number>>;

  /** One-line flavor text shown on team page */
  identity: string;
}

// Default fallback if a team is somehow missing an entry
const DEFAULT: Personality = {
  draftStyle: "Need",
  faStyle: "Balanced",
  rebuildBias: "Balanced",
  riskTolerance: 0.5,
  scoutAccuracy: 0.7,
  passBias: 0,
  fourthDownAggression: 0.4,
  blitzRate: 0.5,
  tempo: 0.5,
  positionValueMods: {},
  identity: "Balanced front office, no extreme tendencies.",
};

export const PERSONALITIES: Record<string, Personality> = {
  // ===== AFC East =====
  BUF: {
    draftStyle: "BPA", faStyle: "Balanced", rebuildBias: "WinNow",
    riskTolerance: 0.55, scoutAccuracy: 0.82,
    passBias: 0.06, fourthDownAggression: 0.62, blitzRate: 0.62, tempo: 0.62,
    positionValueMods: { DL: 1.15, WR: 1.10, OL: 1.10, DB: 1.05 },
    identity: "Smart, BPA-leaning office. Aggressive defense, QB-driven offense.",
  },
  MIA: {
    draftStyle: "Skill", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.65, scoutAccuracy: 0.70,
    passBias: 0.10, fourthDownAggression: 0.55, blitzRate: 0.55, tempo: 0.78,
    positionValueMods: { WR: 1.30, DB: 1.15, OL: 0.95, RB: 0.90 },
    identity: "Speed kills. Air-it-out offense, premium coverage corners.",
  },
  NE: {
    draftStyle: "Safe", faStyle: "Conservative", rebuildBias: "Rebuild",
    riskTolerance: 0.30, scoutAccuracy: 0.78,
    passBias: -0.02, fourthDownAggression: 0.30, blitzRate: 0.45, tempo: 0.40,
    positionValueMods: { LB: 1.20, DL: 1.10, OL: 1.10, WR: 0.85 },
    identity: "Value-driven, defensively-minded, draft-and-develop classics.",
  },
  NYJ: {
    draftStyle: "Need", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.60, scoutAccuracy: 0.65,
    passBias: 0.02, fourthDownAggression: 0.45, blitzRate: 0.65, tempo: 0.50,
    positionValueMods: { DL: 1.25, DB: 1.15, OL: 1.05, WR: 1.10 },
    identity: "Fortune-telling defense. Big swings on veterans to plug holes.",
  },
  // ===== AFC North =====
  BAL: {
    draftStyle: "BPA", faStyle: "Bargain", rebuildBias: "WinNow",
    riskTolerance: 0.45, scoutAccuracy: 0.88,
    passBias: -0.06, fourthDownAggression: 0.65, blitzRate: 0.70, tempo: 0.55,
    positionValueMods: { OL: 1.20, DL: 1.20, LB: 1.10, RB: 1.10 },
    identity: "Trust the board. Run-heavy attack, blitz-happy aggressive D.",
  },
  CIN: {
    draftStyle: "Skill", faStyle: "Balanced", rebuildBias: "WinNow",
    riskTolerance: 0.55, scoutAccuracy: 0.72,
    passBias: 0.10, fourthDownAggression: 0.50, blitzRate: 0.50, tempo: 0.65,
    positionValueMods: { WR: 1.30, OL: 1.15, DL: 1.05, QB: 1.20 },
    identity: "Pass-first identity. Heavy investment in QB and skill weapons.",
  },
  CLE: {
    draftStyle: "BPA", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.70, scoutAccuracy: 0.65,
    passBias: -0.04, fourthDownAggression: 0.55, blitzRate: 0.65, tempo: 0.50,
    positionValueMods: { DL: 1.30, OL: 1.15, RB: 1.10, WR: 1.05 },
    identity: "Big swings. Pay edge rushers like quarterbacks.",
  },
  PIT: {
    draftStyle: "Trenches", faStyle: "Conservative", rebuildBias: "Balanced",
    riskTolerance: 0.40, scoutAccuracy: 0.80,
    passBias: -0.04, fourthDownAggression: 0.35, blitzRate: 0.62, tempo: 0.45,
    positionValueMods: { DL: 1.25, LB: 1.20, OL: 1.10, DB: 1.05 },
    identity: "Standards. Defense first, hard-nosed running, draft-and-develop.",
  },
  // ===== AFC South =====
  HOU: {
    draftStyle: "BPA", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.55, scoutAccuracy: 0.75,
    passBias: 0.06, fourthDownAggression: 0.58, blitzRate: 0.60, tempo: 0.62,
    positionValueMods: { WR: 1.20, DL: 1.20, OL: 1.10, QB: 1.15 },
    identity: "Young core, ambitious moves. Build through the trenches.",
  },
  IND: {
    draftStyle: "Need", faStyle: "Balanced", rebuildBias: "Balanced",
    riskTolerance: 0.50, scoutAccuracy: 0.72,
    passBias: 0.00, fourthDownAggression: 0.45, blitzRate: 0.50, tempo: 0.55,
    positionValueMods: { OL: 1.15, DL: 1.10, RB: 1.10, DB: 1.10 },
    identity: "Build inside out. Versatile, balanced rosters.",
  },
  JAX: {
    draftStyle: "Need", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.60, scoutAccuracy: 0.62,
    passBias: 0.05, fourthDownAggression: 0.55, blitzRate: 0.55, tempo: 0.58,
    positionValueMods: { WR: 1.20, DL: 1.15, DB: 1.15 },
    identity: "Spend hard to flip the franchise. Skill-heavy investments.",
  },
  TEN: {
    draftStyle: "Trenches", faStyle: "Conservative", rebuildBias: "Rebuild",
    riskTolerance: 0.40, scoutAccuracy: 0.70,
    passBias: -0.10, fourthDownAggression: 0.40, blitzRate: 0.55, tempo: 0.40,
    positionValueMods: { OL: 1.30, RB: 1.20, DL: 1.15, LB: 1.10 },
    identity: "Punch you in the mouth. Heavy run, physical defense.",
  },
  // ===== AFC West =====
  DEN: {
    draftStyle: "Need", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.65, scoutAccuracy: 0.65,
    passBias: 0.02, fourthDownAggression: 0.50, blitzRate: 0.55, tempo: 0.55,
    positionValueMods: { QB: 1.40, WR: 1.10, OL: 1.10, DB: 1.10 },
    identity: "Forever chasing the QB. Will overpay to find one.",
  },
  KC: {
    draftStyle: "BPA", faStyle: "Balanced", rebuildBias: "WinNow",
    riskTolerance: 0.55, scoutAccuracy: 0.85,
    passBias: 0.12, fourthDownAggression: 0.70, blitzRate: 0.55, tempo: 0.70,
    positionValueMods: { OL: 1.25, WR: 1.20, DL: 1.10, TE: 1.15 },
    identity: "Elite QB ecosystem. Pay the OL, gather weapons, dare you to keep up.",
  },
  LV: {
    draftStyle: "BoomBust", faStyle: "Aggressive", rebuildBias: "Balanced",
    riskTolerance: 0.78, scoutAccuracy: 0.55,
    passBias: 0.04, fourthDownAggression: 0.55, blitzRate: 0.60, tempo: 0.55,
    positionValueMods: { WR: 1.20, DL: 1.20, RB: 1.10 },
    identity: "Swing for the fences. Glamour signings, occasional disasters.",
  },
  LAC: {
    draftStyle: "Skill", faStyle: "Balanced", rebuildBias: "Balanced",
    riskTolerance: 0.55, scoutAccuracy: 0.72,
    passBias: 0.10, fourthDownAggression: 0.50, blitzRate: 0.55, tempo: 0.60,
    positionValueMods: { WR: 1.25, OL: 1.15, DL: 1.10, DB: 1.10 },
    identity: "Air-it-out offense. Star-driven roster construction.",
  },
  // ===== NFC East =====
  DAL: {
    draftStyle: "BPA", faStyle: "Conservative", rebuildBias: "WinNow",
    riskTolerance: 0.50, scoutAccuracy: 0.78,
    passBias: 0.04, fourthDownAggression: 0.45, blitzRate: 0.55, tempo: 0.55,
    positionValueMods: { OL: 1.20, DL: 1.20, WR: 1.15, QB: 1.15 },
    identity: "Spend on the core, draft & develop the rest. Stars, not depth.",
  },
  NYG: {
    draftStyle: "Trenches", faStyle: "Conservative", rebuildBias: "Rebuild",
    riskTolerance: 0.40, scoutAccuracy: 0.65,
    passBias: -0.04, fourthDownAggression: 0.40, blitzRate: 0.55, tempo: 0.45,
    positionValueMods: { OL: 1.25, DL: 1.20, LB: 1.10 },
    identity: "Build through the trenches. Patient, fundamental.",
  },
  PHI: {
    draftStyle: "BPA", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.65, scoutAccuracy: 0.86,
    passBias: 0.04, fourthDownAggression: 0.75, blitzRate: 0.55, tempo: 0.55,
    positionValueMods: { OL: 1.30, DL: 1.30, DB: 1.10, WR: 1.10 },
    identity: "Sharp office. Heavy on trenches, aggressive on 4th down.",
  },
  WAS: {
    draftStyle: "Need", faStyle: "Balanced", rebuildBias: "Rebuild",
    riskTolerance: 0.50, scoutAccuracy: 0.68,
    passBias: 0.02, fourthDownAggression: 0.45, blitzRate: 0.50, tempo: 0.50,
    positionValueMods: { QB: 1.20, OL: 1.15, DL: 1.10, WR: 1.10 },
    identity: "Rebuild around a young QB. Disciplined cap management.",
  },
  // ===== NFC North =====
  CHI: {
    draftStyle: "BPA", faStyle: "Balanced", rebuildBias: "Rebuild",
    riskTolerance: 0.55, scoutAccuracy: 0.72,
    passBias: 0.00, fourthDownAggression: 0.45, blitzRate: 0.55, tempo: 0.50,
    positionValueMods: { QB: 1.25, OL: 1.20, WR: 1.15, DL: 1.10 },
    identity: "Build the offense around the franchise QB. Patient buildup.",
  },
  DET: {
    draftStyle: "Trenches", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.65, scoutAccuracy: 0.85,
    passBias: 0.02, fourthDownAggression: 0.78, blitzRate: 0.55, tempo: 0.62,
    positionValueMods: { OL: 1.30, DL: 1.20, RB: 1.10, WR: 1.10 },
    identity: "Bullies. Trenches first, hyper-aggressive on 4th down.",
  },
  GB: {
    draftStyle: "BPA", faStyle: "Conservative", rebuildBias: "Balanced",
    riskTolerance: 0.45, scoutAccuracy: 0.84,
    passBias: 0.04, fourthDownAggression: 0.45, blitzRate: 0.55, tempo: 0.55,
    positionValueMods: { WR: 1.20, OL: 1.15, DL: 1.10, DB: 1.05 },
    identity: "Draft & develop. Rarely dip into free agency, almost never overpay.",
  },
  MIN: {
    draftStyle: "Skill", faStyle: "Balanced", rebuildBias: "Balanced",
    riskTolerance: 0.55, scoutAccuracy: 0.72,
    passBias: 0.06, fourthDownAggression: 0.50, blitzRate: 0.65, tempo: 0.58,
    positionValueMods: { WR: 1.25, DL: 1.15, DB: 1.10, OL: 1.10 },
    identity: "Star receivers, blitz-heavy defense.",
  },
  // ===== NFC South =====
  ATL: {
    draftStyle: "Skill", faStyle: "Balanced", rebuildBias: "Balanced",
    riskTolerance: 0.50, scoutAccuracy: 0.70,
    passBias: 0.04, fourthDownAggression: 0.45, blitzRate: 0.50, tempo: 0.55,
    positionValueMods: { WR: 1.20, RB: 1.15, DL: 1.10, OL: 1.10 },
    identity: "Skill-position-rich offense. Patient defense rebuild.",
  },
  CAR: {
    draftStyle: "Need", faStyle: "Balanced", rebuildBias: "Rebuild",
    riskTolerance: 0.50, scoutAccuracy: 0.65,
    passBias: 0.00, fourthDownAggression: 0.45, blitzRate: 0.55, tempo: 0.50,
    positionValueMods: { QB: 1.25, OL: 1.20, WR: 1.15, DL: 1.10 },
    identity: "Top-down rebuild. Lots of holes, lots of picks.",
  },
  NO: {
    draftStyle: "BPA", faStyle: "Aggressive", rebuildBias: "WinNow",
    riskTolerance: 0.65, scoutAccuracy: 0.72,
    passBias: 0.04, fourthDownAggression: 0.50, blitzRate: 0.60, tempo: 0.55,
    positionValueMods: { OL: 1.20, DL: 1.20, WR: 1.10, DB: 1.10 },
    identity: "Cap-stretched veteran roster. Wins now, deals with consequences later.",
  },
  TB: {
    draftStyle: "BPA", faStyle: "Balanced", rebuildBias: "WinNow",
    riskTolerance: 0.55, scoutAccuracy: 0.75,
    passBias: 0.08, fourthDownAggression: 0.55, blitzRate: 0.65, tempo: 0.62,
    positionValueMods: { WR: 1.20, DL: 1.20, LB: 1.10, OL: 1.10 },
    identity: "Veteran-heavy. Heavy passing offense, blitz-happy defense.",
  },
  // ===== NFC West =====
  ARI: {
    draftStyle: "Skill", faStyle: "Balanced", rebuildBias: "Balanced",
    riskTolerance: 0.60, scoutAccuracy: 0.65,
    passBias: 0.10, fourthDownAggression: 0.55, blitzRate: 0.55, tempo: 0.72,
    positionValueMods: { WR: 1.25, OL: 1.10, DL: 1.10, QB: 1.15 },
    identity: "Up-tempo, vertical attack. Building around a mobile QB.",
  },
  LAR: {
    draftStyle: "BoomBust", faStyle: "AllIn", rebuildBias: "WinNow",
    riskTolerance: 0.85, scoutAccuracy: 0.74,
    passBias: 0.08, fourthDownAggression: 0.60, blitzRate: 0.65, tempo: 0.62,
    positionValueMods: { DL: 1.30, WR: 1.20, OL: 1.10, DB: 1.10 },
    identity: "F— them picks. Mortgage the future for stars.",
  },
  SF: {
    draftStyle: "Trenches", faStyle: "Balanced", rebuildBias: "WinNow",
    riskTolerance: 0.55, scoutAccuracy: 0.86,
    passBias: 0.02, fourthDownAggression: 0.55, blitzRate: 0.60, tempo: 0.55,
    positionValueMods: { OL: 1.25, DL: 1.30, RB: 1.10, TE: 1.15 },
    identity: "Trenches obsessed. Elite scheme, dominant fronts on both sides.",
  },
  SEA: {
    draftStyle: "BPA", faStyle: "Balanced", rebuildBias: "Balanced",
    riskTolerance: 0.55, scoutAccuracy: 0.74,
    passBias: 0.02, fourthDownAggression: 0.45, blitzRate: 0.60, tempo: 0.55,
    positionValueMods: { DB: 1.25, DL: 1.15, OL: 1.10, WR: 1.10 },
    identity: "Legion-of-Boom DNA. Heavy defensive backs investment.",
  },
};

export function personalityFor(teamId: string): Personality {
  return PERSONALITIES[teamId] ?? DEFAULT;
}

// =====================================================================
// Scheme fit: how well a player's profile matches the team's offensive
// or defensive scheme. Returns a multiplier ~0.85..1.15.
// =====================================================================

import type { Team } from "@/lib/types";

export function schemeFit(team: Team, position: Position): number {
  const off = team.offenseScheme;
  const def = team.defenseScheme;

  // Offensive scheme effects
  if (["QB"].includes(position)) {
    if (off === "Air Raid" || off === "Spread") return 1.05;
  }
  if (position === "WR") {
    if (off === "Air Raid") return 1.12;
    if (off === "Spread") return 1.08;
    if (off === "West Coast") return 1.05;
    if (off === "Power Run") return 0.92;
  }
  if (position === "TE") {
    if (off === "West Coast" || off === "Pro Style") return 1.08;
    if (off === "Air Raid") return 0.92;
  }
  if (position === "RB" || position === "FB") {
    if (off === "Power Run") return 1.15;
    if (off === "Pro Style") return 1.05;
    if (off === "Air Raid") return 0.85;
  }
  if (["LT","RT","LG","RG","C"].includes(position)) {
    if (off === "Power Run") return 1.08;       // mauler types
    if (off === "Air Raid") return 0.96;
  }

  // Defensive scheme effects
  if (["LE","RE"].includes(position)) {
    if (def === "4-3") return 1.06;             // true edges
    if (def === "3-4") return 0.98;
  }
  if (position === "DT") {
    if (def === "3-4") return 1.10;             // need a NT
    if (def === "Cover 2" || def === "Tampa 2") return 1.05;
  }
  if (position === "MLB" || position === "OLB") {
    if (def === "3-4") return 1.06;
    if (def === "Tampa 2") return 1.05;
  }
  if (["CB","FS","SS"].includes(position)) {
    if (def === "Nickel D" || def === "Cover 2") return 1.08;
  }
  return 1.0;
}
