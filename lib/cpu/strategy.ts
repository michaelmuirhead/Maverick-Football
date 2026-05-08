import type { League, Player, Position, Team } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { ROSTER_TARGETS, POSITION_GROUP } from "@/lib/data/positions";
import { getRoster } from "@/lib/gen/roster";
import { computeMarketValue } from "@/lib/gen/player";
import { personalityFor, schemeFit, type Personality } from "./personalities";
import { clamp } from "@/lib/utils";

// =====================================================================
// Runtime CPU strategy: derives a team's current phase, position needs,
// scheme-adjusted player valuations, and bidding ceilings.
// =====================================================================

export type Phase = "WinNow" | "Balanced" | "Rebuild";

/** Determine where a team sits — drives FA aggression and draft priorities. */
export function computeTeamPhase(league: League, teamId: string): Phase {
  const personality = personalityFor(teamId);
  const standing = league.standings[teamId];
  const wp = (standing.w + standing.t * 0.5) / Math.max(standing.w + standing.l + standing.t, 1);

  const roster = getRoster(league, teamId);
  const starters = roster.filter((p) => p.depth === "Starter");
  const avgAge = starters.length ? starters.reduce((a, p) => a + p.age, 0) / starters.length : 27;
  const teamOvr = starters.length ? starters.reduce((a, p) => a + p.ovr, 0) / starters.length : 70;

  // Score from -1 (rebuild) to +1 (win-now)
  let score = 0;
  if (wp >= 0.65) score += 0.6;
  else if (wp >= 0.55) score += 0.3;
  else if (wp <= 0.35) score -= 0.5;
  else if (wp <= 0.45) score -= 0.2;

  if (avgAge >= 29) score += 0.4;       // older roster → push now
  else if (avgAge <= 25) score -= 0.3;  // young → wait

  if (teamOvr >= 80) score += 0.3;
  else if (teamOvr <= 70) score -= 0.3;

  if (personality.rebuildBias === "WinNow") score += 0.4;
  if (personality.rebuildBias === "Rebuild") score -= 0.5;

  if (score > 0.4) return "WinNow";
  if (score < -0.4) return "Rebuild";
  return "Balanced";
}

/** Score each position by need on a 0..10+ scale. Higher = bigger gap. */
export function positionPriority(league: League, teamId: string): Record<Position, number> {
  const team = TEAMS_BY_ID[teamId];
  const personality = personalityFor(teamId);
  const roster = getRoster(league, teamId);
  const counts: Record<string, number> = {};
  for (const p of roster) counts[p.position] = (counts[p.position] ?? 0) + 1;

  const out = {} as Record<Position, number>;

  for (const [posStr, target] of Object.entries(ROSTER_TARGETS)) {
    const pos = posStr as Position;
    const have = counts[pos] ?? 0;
    const starters = roster.filter((p) => p.position === pos && p.depth === "Starter");
    const starter = starters[0];
    const starterOvr = starter?.ovr ?? 50;
    const starterAge = starter?.age ?? 30;
    const backup = roster.filter((p) => p.position === pos && p.depth === "Backup")[0];
    const backupOvr = backup?.ovr ?? 50;

    // Components:
    // (a) numerical shortage
    const shortage = Math.max(0, target - have) * 2.0;
    // (b) starter quality gap (pushed harder for premium positions)
    const starterGap = Math.max(0, 78 - starterOvr) / 4;
    // (c) backup gap (less weight)
    const backupGap = Math.max(0, 70 - backupOvr) / 8;
    // (d) age cliff: starter is old → flag the position even if currently strong
    const ageCliff = starterAge >= 32 ? 1.5 : starterAge >= 30 ? 0.7 : 0;
    // (e) injury — if starter currently injured, mild bump
    const injured = starter?.injuryWeeks && starter.injuryWeeks > 4 ? 1.0 : 0;

    let raw = shortage + starterGap + backupGap + ageCliff + injured;

    // (f) Personality multiplier on the position group
    const grp = POSITION_GROUP[pos];
    const groupMod = personality.positionValueMods[grp] ?? 1.0;
    raw *= groupMod;

    // (g) Scheme fit isn't a need driver, but Power Run teams care less about a 4th WR
    const fit = schemeFit(team, pos);
    raw *= 0.7 + 0.3 * fit; // dampen — this is a smaller effect on need

    // (h) Trenches/Skill draft style biases stay relatively contained
    if (personality.draftStyle === "Trenches" && (grp === "OL" || grp === "DL")) raw *= 1.15;
    if (personality.draftStyle === "Skill" && (grp === "QB" || grp === "WR" || grp === "RB" || grp === "TE")) raw *= 1.15;

    out[pos] = raw;
  }

  return out;
}

/** Top-level position-group needs (used by tiered logic) */
export function groupPriority(league: League, teamId: string): Record<string, number> {
  const pri = positionPriority(league, teamId);
  const out: Record<string, number> = {};
  for (const [posStr, score] of Object.entries(pri)) {
    const pos = posStr as Position;
    const grp = POSITION_GROUP[pos];
    out[grp] = (out[grp] ?? 0) + score;
  }
  return out;
}

/** Player's value (in $M AAV) in this signing team's eyes. */
export function valueToTeam(league: League, teamId: string, player: Player): number {
  const team = TEAMS_BY_ID[teamId];
  const personality = personalityFor(teamId);
  const phase = computeTeamPhase(league, teamId);
  const baseMarket = computeMarketValue(player.position, player.ovr, player.age);
  const fit = schemeFit(team, player.position);
  const need = positionPriority(league, teamId)[player.position] ?? 0;

  // Phase multipliers
  let phaseMult = 1.0;
  if (phase === "WinNow") {
    phaseMult = player.age <= 28 ? 1.05 : player.age <= 31 ? 1.10 : 1.0;
  } else if (phase === "Rebuild") {
    // Rebuilders don't care about old vets
    phaseMult = player.age >= 30 ? 0.65 : player.age <= 26 ? 1.05 : 0.90;
  }

  // FA style multiplier
  let faMult = 1.0;
  switch (personality.faStyle) {
    case "Aggressive": faMult = 1.15; break;
    case "AllIn": faMult = 1.30; break;
    case "Balanced": faMult = 1.0; break;
    case "Conservative": faMult = 0.88; break;
    case "Bargain": faMult = 0.78; break;
  }

  // Need multiplier — bigger need → willing to pay more
  const needMult = clamp(0.7 + need * 0.05, 0.7, 1.55);

  // Star tax — top players command more on a contender
  let starTax = 1.0;
  if (player.ovr >= 88 && phase === "WinNow") starTax = 1.10;
  if (player.ovr >= 92 && personality.faStyle === "AllIn") starTax = 1.20;

  return Math.max(0.5, baseMarket * phaseMult * faMult * needMult * fit * starTax);
}

/** What a team is willing to ask the player to take, given cap room. */
export function maxBid(league: League, teamId: string, player: Player, capRoom: number): number {
  const team = TEAMS_BY_ID[teamId];
  const personality = personalityFor(teamId);
  const v = valueToTeam(league, teamId, player);
  // Discipline: leave at least some buffer
  const discipline = personality.faStyle === "AllIn" ? 0.95 : personality.faStyle === "Aggressive" ? 0.85 : personality.faStyle === "Balanced" ? 0.75 : 0.65;
  const ceiling = capRoom * discipline;
  return Math.min(v, Math.max(0, ceiling));
}

/** Player's perceived "scout grade" from a specific team. Better scouting orgs see closer to true value. */
export function teamScoutGrade(league: League, teamId: string, player: Player, baseGrade: number): number {
  const personality = personalityFor(teamId);
  const noise = (1 - personality.scoutAccuracy) * 8; // 0..2.4
  // Anchor on basGrade with team-specific noise
  const seed = `scout:${teamId}:${player.id}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r1 = ((h >>> 0) % 1000) / 1000;
  const r2 = (((h * 31) >>> 0) % 1000) / 1000;
  const norm = Math.sqrt(-2 * Math.log(Math.max(r1, 1e-6))) * Math.cos(2 * Math.PI * r2);
  return clamp(baseGrade + norm * noise, 40, 99);
}

/** Convenience re-exports */
export { personalityFor, schemeFit };
export type { Personality };
