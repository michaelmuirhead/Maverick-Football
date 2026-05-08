import { RNG } from "@/lib/rng";
import type { Attributes, Player, Position } from "@/lib/types";
import { FIRST_NAMES, LAST_NAMES, HOMETOWN_CITIES } from "@/lib/data/names";
import { COLLEGES } from "@/lib/data/colleges";
import { BODY_TEMPLATE, OVR_WEIGHTS } from "@/lib/data/positions";
import { clamp } from "@/lib/utils";

let pid = 1;
export function newPlayerId(): string { return `p${pid++}`; }
export function setPlayerIdSeed(n: number) { pid = n; }
export function currentPlayerIdSeed() { return pid; }

const BASE_ATTRS: (keyof Attributes)[] = ["awr","spd","acc","agi","str","jmp","sta","dur"];

const POS_ATTR_MAP: Record<Position, (keyof Attributes)[]> = {
  QB:  [...BASE_ATTRS, "thp","tha","pac","tup"],
  RB:  [...BASE_ATTRS, "car","btk","ela","vis","cat"],
  FB:  [...BASE_ATTRS, "rbk","cat","btk","str"],
  WR:  [...BASE_ATTRS, "cat","rls","rte","jmp"],
  TE:  [...BASE_ATTRS, "cat","rte","rbk","pbk"],
  LT:  [...BASE_ATTRS, "pbk","rbk","ibl"],
  LG:  [...BASE_ATTRS, "pbk","rbk","ibl"],
  C:   [...BASE_ATTRS, "pbk","rbk","ibl"],
  RG:  [...BASE_ATTRS, "pbk","rbk","ibl"],
  RT:  [...BASE_ATTRS, "pbk","rbk","ibl"],
  LE:  [...BASE_ATTRS, "pmv","fmv","bsh","tak"],
  DT:  [...BASE_ATTRS, "pmv","bsh","str","tak","fmv"],
  RE:  [...BASE_ATTRS, "pmv","fmv","bsh","tak"],
  MLB: [...BASE_ATTRS, "tak","pcv","zcv","hpw","bsh"],
  OLB: [...BASE_ATTRS, "tak","pmv","fmv","pcv","zcv","hpw"],
  CB:  [...BASE_ATTRS, "pcv","zcv","prc","cat"],
  FS:  [...BASE_ATTRS, "pcv","zcv","tak","hpw"],
  SS:  [...BASE_ATTRS, "pcv","zcv","tak","hpw","str"],
  K:   [...BASE_ATTRS, "kpw","kac"],
  P:   [...BASE_ATTRS, "kpw","kac"],
};

interface GenOptions {
  position: Position;
  /** target overall (40–99) */
  ovrTarget: number;
  /** age (years) */
  age: number;
  /** ceiling above current OVR */
  potBoost?: number;
  /** team id for jersey/contract context */
  team?: string | null;
  /** draft year (for rookies) */
  draftYear?: number;
  /** draft round/pick */
  draftRound?: number; draftPick?: number;
  /** signing year for contract */
  year: number;
  rng: RNG;
}

function genAttribute(rng: RNG, mean: number): number {
  const v = Math.round(rng.normal(mean, 6));
  return clamp(v, 30, 99);
}

export function computeOVR(pos: Position, attrs: Attributes): number {
  const w = OVR_WEIGHTS[pos];
  let sum = 0;
  let totalW = 0;
  for (const k in w) {
    const weight = (w as any)[k] as number;
    const val = (attrs as any)[k] as number | undefined;
    if (typeof val === "number") {
      sum += val * weight;
      totalW += weight;
    }
  }
  return Math.round(totalW > 0 ? sum / totalW : 50);
}

export function generatePlayer(opts: GenOptions): Player {
  const { position, ovrTarget, age, year, rng } = opts;
  const attrs: Attributes = {} as Attributes;

  const relevantAttrs = POS_ATTR_MAP[position];
  // Set important attrs (those in OVR_WEIGHTS) near ovrTarget; others lower
  const w = OVR_WEIGHTS[position];
  for (const a of relevantAttrs) {
    const isPrimary = (w as any)[a] !== undefined;
    const mean = isPrimary ? ovrTarget : ovrTarget - 12;
    (attrs as any)[a] = genAttribute(rng, mean);
  }

  // Clamp post-hoc to hit target OVR roughly
  let ovr = computeOVR(position, attrs);
  let safety = 0;
  while (Math.abs(ovr - ovrTarget) > 3 && safety < 12) {
    const delta = ovrTarget - ovr;
    for (const a of Object.keys(w) as (keyof Attributes)[]) {
      const cur = (attrs as any)[a] as number;
      (attrs as any)[a] = clamp(cur + Math.round(delta / 2), 30, 99);
    }
    ovr = computeOVR(position, attrs);
    safety++;
  }

  // Potential — for young players, ceiling may be higher
  const yearsUntilPeak = Math.max(0, 27 - age);
  const baseBoost = opts.potBoost ?? 0;
  const pot = clamp(ovr + Math.round(rng.float(0, yearsUntilPeak * 0.8)) + baseBoost, ovr, 99);

  const [meanH, sdH, meanW, sdW] = BODY_TEMPLATE[position];
  const heightIn = Math.round(rng.normal(meanH, sdH));
  const weightLb = Math.round(rng.normal(meanW, sdW));

  const firstName = rng.pick(FIRST_NAMES);
  const lastName = rng.pick(LAST_NAMES);
  const college = rng.pick(COLLEGES);
  const hometown = rng.pick(HOMETOWN_CITIES);
  const jersey = rng.int(1, 99);

  const aav = computeMarketValue(position, ovr, age);
  const contract = opts.team
    ? { years: rng.int(2, 5), aav, signedYear: year, signingBonus: aav * rng.float(0.2, 0.6) }
    : null;

  return {
    id: newPlayerId(),
    firstName,
    lastName,
    position,
    team: opts.team ?? null,
    jersey,
    age,
    birthYear: year - age,
    heightIn,
    weightLb,
    college,
    hometown,
    ovr,
    pot,
    attributes: attrs,
    contract,
    depth: "Reserve",
    injuryWeeks: 0,
    retired: false,
    draftYear: opts.draftYear ?? year - (age - 22),
    draftRound: opts.draftRound,
    draftPick: opts.draftPick,
    history: [],
  };
}

/** Approx free-market AAV in millions */
export function computeMarketValue(pos: Position, ovr: number, age: number): number {
  // Position multipliers — premium positions: QB, EDGE, OL T, WR, CB
  const pm: Record<string, number> = {
    QB: 1.7, LE: 1.25, RE: 1.25, OLB: 1.05, LT: 1.2, RT: 1.15, WR: 1.15, CB: 1.15,
    DT: 1.05, TE: 0.95, RB: 0.85, FB: 0.5, LG: 1.0, RG: 1.0, C: 1.0,
    MLB: 0.95, FS: 0.9, SS: 0.9, K: 0.45, P: 0.4,
  };
  const mult = pm[pos] ?? 1;
  // Curve: 70 ovr ~= $4M, 80 ~= $14M, 90 ~= $34M, 95 ~= $48M
  const base = Math.max(1.0, Math.pow(Math.max(ovr - 60, 0), 1.55) * 0.18);
  // Age penalty after 30
  const ageMult = age >= 32 ? 0.7 : age >= 30 ? 0.85 : age <= 24 ? 0.95 : 1.0;
  return Math.round(base * mult * ageMult * 10) / 10; // 0.1M precision
}
