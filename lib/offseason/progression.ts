import { RNG } from "@/lib/rng";
import type { Attributes, League, Player } from "@/lib/types";
import { computeOVR } from "@/lib/gen/player";
import { OVR_WEIGHTS, POSITION_GROUP } from "@/lib/data/positions";
import { staffOf } from "@/lib/cpu/coaches";
import { clamp } from "@/lib/utils";

/**
 * Each offseason, players age, develop, or decline.
 * - Age <= 26: positive growth toward potential
 * - Age 27–29: small flux
 * - Age 30+: gradual decline
 * Pro Bowls and heavy snap counts boost growth.
 * The team's coordinators boost development through their `development` attribute.
 */
export function progressPlayers(league: League) {
  const rng = new RNG(`prog:${league.year}`);
  for (const p of Object.values(league.players)) {
    if (p.retired) continue;
    p.age += 1;

    const yr = league.year;
    const lastSeason = p.history.find((h) => h.year === yr);
    const proBowl = lastSeason?.proBowl ? 1 : 0;
    const allPro = lastSeason?.allPro ? 2 : 0;
    const gp = lastSeason?.gp ?? 0;
    const playedHeavy = gp >= 12 ? 1 : 0;

    let delta = 0;
    if (p.age <= 23) delta = rng.normal(2.0, 1.2);
    else if (p.age <= 26) delta = rng.normal(1.0, 1.0);
    else if (p.age <= 29) delta = rng.normal(0.0, 1.0);
    else if (p.age <= 32) delta = rng.normal(-1.5, 1.0);
    else delta = rng.normal(-3.0, 1.4);

    delta += proBowl * 0.5 + allPro * 0.5 + playedHeavy * 0.4;

    // Coach development bonus — applies to young players most strongly
    if (p.team) {
      const grp = POSITION_GROUP[p.position];
      const isOff = grp === "QB" || grp === "RB" || grp === "WR" || grp === "TE" || grp === "OL";
      const { hc, oc, dc } = staffOf(league, p.team);
      const relevantCoach = isOff ? oc : (grp === "ST" ? hc : dc);
      const dev = relevantCoach?.attrs.development ?? 70;
      const hcBoost = (hc?.attrs.leadership ?? 70) * 0.05;
      // 60-90 dev maps to ~-0.6 to +1.2 bonus, scaled by youth
      const youthFactor = p.age <= 24 ? 1.0 : p.age <= 27 ? 0.6 : 0.25;
      const coachBoost = ((dev - 70) * 0.06 + (hcBoost - 3.5) * 0.15) * youthFactor;
      delta += coachBoost;
    }

    if (p.ovr >= p.pot) delta = Math.min(delta, 0.5); // cap at potential

    const target = clamp(p.ovr + Math.round(delta), 40, Math.min(99, p.pot + 1));
    if (target === p.ovr) continue;

    bumpAttrs(p.attributes, p.position, target - p.ovr, rng);
    p.ovr = computeOVR(p.position, p.attributes);
    if (p.ovr > p.pot) p.pot = p.ovr;
  }
}

function bumpAttrs(attrs: Attributes, pos: string, delta: number, rng: RNG) {
  const w = OVR_WEIGHTS[pos as keyof typeof OVR_WEIGHTS];
  if (!w) return;
  const keys = Object.keys(w) as (keyof Attributes)[];
  for (const k of keys) {
    const cur = (attrs as any)[k] as number;
    const change = Math.round(delta + rng.normal(0, 0.6));
    (attrs as any)[k] = clamp(cur + change, 30, 99);
  }
}
