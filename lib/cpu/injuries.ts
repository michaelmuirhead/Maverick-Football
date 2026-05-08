import { RNG } from "@/lib/rng";
import type { Game, Injury, InjurySeverity, League, Player } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";

// =====================================================================
// Typed injury system. Each injury has a name, severity tier, and
// realistic recovery weeks. Major injuries can land players on IR;
// season-ending injuries on aging players raise retirement chance.
// =====================================================================

export const IR_SLOTS = 8;

interface InjuryArchetype {
  name: string;
  severity: InjurySeverity;
  minWeeks: number;
  maxWeeks: number;
  weight: number;          // weighted draw
  positionBias?: string[]; // positions that more often get this
}

const INJURY_TABLE: InjuryArchetype[] = [
  { name: "Ankle sprain",       severity: "Minor",        minWeeks: 1,  maxWeeks: 2,  weight: 18 },
  { name: "Hamstring strain",   severity: "Minor",        minWeeks: 1,  maxWeeks: 3,  weight: 14 },
  { name: "Concussion",         severity: "Minor",        minWeeks: 1,  maxWeeks: 2,  weight: 8 },
  { name: "Hand/wrist sprain",  severity: "Minor",        minWeeks: 1,  maxWeeks: 2,  weight: 6 },
  { name: "Shoulder sprain",    severity: "Moderate",     minWeeks: 2,  maxWeeks: 4,  weight: 10 },
  { name: "Knee sprain",        severity: "Moderate",     minWeeks: 3,  maxWeeks: 5,  weight: 9 },
  { name: "High ankle sprain",  severity: "Moderate",     minWeeks: 3,  maxWeeks: 6,  weight: 7 },
  { name: "Pulled groin",       severity: "Moderate",     minWeeks: 2,  maxWeeks: 5,  weight: 5 },
  { name: "Broken finger",      severity: "Minor",        minWeeks: 1,  maxWeeks: 3,  weight: 4 },
  { name: "Fractured rib",      severity: "Moderate",     minWeeks: 2,  maxWeeks: 5,  weight: 3 },
  { name: "Dislocated shoulder",severity: "Major",        minWeeks: 5,  maxWeeks: 8,  weight: 4 },
  { name: "MCL tear",           severity: "Major",        minWeeks: 4,  maxWeeks: 8,  weight: 4 },
  { name: "Foot fracture",      severity: "Major",        minWeeks: 6,  maxWeeks: 10, weight: 3 },
  { name: "Pectoral tear",      severity: "Major",        minWeeks: 6,  maxWeeks: 10, weight: 2 },
  { name: "Torn ACL",           severity: "SeasonEnding", minWeeks: 14, maxWeeks: 22, weight: 2 },
  { name: "Torn Achilles",      severity: "SeasonEnding", minWeeks: 16, maxWeeks: 26, weight: 1 },
  { name: "Broken leg",         severity: "SeasonEnding", minWeeks: 12, maxWeeks: 22, weight: 1 },
  { name: "Spinal injury",      severity: "SeasonEnding", minWeeks: 16, maxWeeks: 26, weight: 0.5 },
];

export function rollInjuryForPlayer(
  league: League, game: Game, player: Player, rng: RNG,
): Injury | null {
  // Already injured — no double-hit (handled by caller)
  if (player.injuryWeeks > 0 || player.injury) return null;

  // Durability rating reduces chance of injury type severity
  const dur = player.attributes.dur ?? 70;
  const lottery = rng.weighted(INJURY_TABLE, INJURY_TABLE.map((i) => {
    let w = i.weight;
    if (i.severity === "SeasonEnding") w *= (110 - dur) / 100; // higher dur = less SE
    if (i.severity === "Major") w *= (105 - dur) / 80;
    return Math.max(0.1, w);
  }));
  const weeks = rng.int(lottery.minWeeks, lottery.maxWeeks);
  return {
    type: lottery.name,
    severity: lottery.severity,
    weeks,
    occurredYear: league.year,
    occurredWeek: game.week,
  };
}

/** Apply a freshly rolled injury to a player (mutates league.players + IR). */
export function applyInjury(league: League, player: Player, injury: Injury) {
  player.injury = injury;
  player.injuryWeeks = injury.weeks;
  if (injury.severity === "Major" || injury.severity === "SeasonEnding") {
    if (player.team) {
      const ps = league.practiceSquad[player.team];
      // IR doesn't auto-add but we mark the player so UI can suggest IR
      // Actually mark Major+ as on IR by default (frees roster spot)
      player.onIR = true;
    }
  }

  league.news.unshift({
    id: `inj${player.id}-${injury.occurredYear}-${injury.occurredWeek}`,
    year: injury.occurredYear, week: injury.occurredWeek, ts: Date.now(),
    category: "Injury",
    headline:
      `${player.firstName} ${player.lastName} (${player.position}) — ${injury.type}` +
      ` (${labelSeverity(injury.severity)}, ${injury.weeks} wk${injury.weeks === 1 ? "" : "s"})`,
    teamId: player.team ?? undefined,
    playerId: player.id,
  });
}

export function labelSeverity(s: InjurySeverity): string {
  switch (s) {
    case "Minor": return "Day-to-day";
    case "Moderate": return "Weeks";
    case "Major": return "Long-term";
    case "SeasonEnding": return "Season-ending";
  }
}

/**
 * Each game inflicts injury rolls on both teams. Probability scales with
 * weekly snap count, so starters are most at risk.
 */
export function rollGameInjuries(league: League, game: Game) {
  const rng = new RNG(`inj:${game.id}`);
  for (const teamId of [game.home, game.away]) {
    const roster = Object.values(league.players).filter(
      (p) => p.team === teamId && !p.retired && !p.injury && !p.onIR && !p.onPracticeSquad,
    );
    // Up to two injuries per team per game (most are minor)
    const tries = 2;
    for (let i = 0; i < tries; i++) {
      // Pick a player weighted toward starters
      const candidates = roster
        .filter((p) => !p.injury)
        .map((p) => ({
          p, w: p.depth === "Starter" ? 6 : p.depth === "Backup" ? 2 : 0.6,
        }));
      if (candidates.length === 0) break;
      // Per-attempt injury chance
      if (!rng.chance(0.18)) continue;
      const pick = rng.weighted(candidates, candidates.map((c) => c.w)).p;
      const injury = rollInjuryForPlayer(league, game, pick, rng);
      if (injury) applyInjury(league, pick, injury);
    }
  }
}

/** Tick all injuries by 1 week (call at end of week). */
export function tickInjuries(league: League) {
  for (const p of Object.values(league.players)) {
    if (!p.injury || p.injuryWeeks <= 0) {
      // Heal: clear flag
      if (p.injuryWeeks <= 0 && p.injury) {
        const wasSE = p.injury.severity === "SeasonEnding";
        p.injury = undefined;
        p.onIR = false;
        if (!wasSE) {
          // Healed, normal recovery; minor news only for Major+
        }
      }
      continue;
    }
    p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);
    p.injury.weeks = p.injuryWeeks;
    if (p.injuryWeeks === 0) {
      const inj = p.injury;
      p.injury = undefined;
      p.onIR = false;
      // Quiet news for Minor; loud for Major+
      if (inj.severity === "Major" || inj.severity === "SeasonEnding") {
        if (p.team) {
          league.news.unshift({
            id: `injback${p.id}-${league.year}-${league.week}`,
            year: league.year, week: league.week, ts: Date.now(),
            category: "Injury",
            headline: `${p.firstName} ${p.lastName} (${p.position}) cleared from ${inj.type}`,
            teamId: p.team, playerId: p.id,
          });
        }
      }
    }
  }
}

/** Check season-ending injuries on aging players for retirement during offseason. */
export function rollInjuryRetirements(league: League) {
  const rng = new RNG(`injret:${league.year}`);
  for (const p of Object.values(league.players)) {
    if (p.retired) continue;
    if (!p.injury) continue;
    if (p.injury.severity !== "SeasonEnding") continue;
    let chance = 0;
    if (p.age >= 33) chance = 0.45;
    else if (p.age >= 30) chance = 0.18;
    else if (p.age >= 28) chance = 0.08;
    if (rng.chance(chance)) {
      p.retired = true;
      p.team = null;
      p.contract = null;
      p.injury = undefined;
      p.onIR = false;
      league.news.unshift({
        id: `injret${p.id}`,
        year: league.year, week: 0, ts: Date.now(),
        category: "Retire",
        headline: `${p.firstName} ${p.lastName} (${p.position}) retires after season-ending injury`,
        playerId: p.id,
      });
    }
  }
}
