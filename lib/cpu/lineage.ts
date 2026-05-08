import { RNG } from "@/lib/rng";
import type { Attributes, DraftProspect, League, Player } from "@/lib/types";
import { generatePlayer, computeOVR } from "@/lib/gen/player";
import { OVR_WEIGHTS } from "@/lib/data/positions";
import { clamp } from "@/lib/utils";

// =====================================================================
// 2nd-generation players: retired stars' sons enter the draft 22+ years
// after the father's career began. Inherits a portion of attributes.
// =====================================================================

const MIN_FATHER_AGE_AT_BIRTH = 22;
const SON_DRAFT_AGE = 22;

export function eligibleFathers(league: League, year: number): Player[] {
  return Object.values(league.players).filter((p) => {
    if (!p.retired) return false;
    // Father had to be career-defining (Pro Bowls or HoF) to make this fun
    const proBowls = p.history.filter((h) => h.proBowl).length;
    const hofYear = p.hofYear !== undefined;
    if (proBowls < 3 && !hofYear) return false;
    // Eligibility window: 22+ years after father's draft
    const fatherDraftYear = p.draftYear;
    return year - fatherDraftYear >= MIN_FATHER_AGE_AT_BIRTH;
  });
}

export function maybeGenerateSons(league: League, draftYear: number, prospects: DraftProspect[], rng: RNG): DraftProspect[] {
  const fathers = eligibleFathers(league, draftYear);
  const added: DraftProspect[] = [];
  for (const father of fathers) {
    if (rng.chance(0.10)) {
      const son = generateSon(father, draftYear, rng);
      added.push(son);
      league.news.unshift({
        id: `son${son.id}`,
        year: draftYear, week: 0, ts: Date.now(),
        category: "Draft",
        headline: `${son.firstName} ${son.lastName} — son of ${father.firstName} ${father.lastName} — declares for the draft`,
        playerId: son.id,
      });
    }
  }
  prospects.push(...added);
  return added;
}

function generateSon(father: Player, year: number, rng: RNG): DraftProspect {
  // Inherit position 50% of the time; otherwise pick a related position
  const positions: Record<string, string[]> = {
    QB: ["QB", "WR"],
    RB: ["RB", "WR"],
    WR: ["WR", "CB", "RB"],
    TE: ["TE", "WR"],
    LT: ["LT", "RT", "LG", "RG"],
    RT: ["LT", "RT", "LG", "RG"],
    LG: ["LG", "RG", "C"],
    RG: ["LG", "RG", "C"],
    C: ["C", "LG", "RG"],
    LE: ["LE", "RE", "OLB"],
    RE: ["LE", "RE", "OLB"],
    DT: ["DT", "RE"],
    MLB: ["MLB", "OLB"],
    OLB: ["OLB", "MLB", "RE"],
    CB: ["CB", "FS", "WR"],
    FS: ["FS", "SS", "CB"],
    SS: ["SS", "FS"],
  };
  const candidates = positions[father.position] ?? [father.position];
  const pos = rng.chance(0.55) ? father.position : rng.pick(candidates);

  // OVR target: favor strong genes (60% of father's peak OVR + ~12 boost noise)
  const peakOvr = Math.max(father.ovr, ...father.history.map((h) => 70)); // father.history doesn't carry per-year ovr; use father.ovr
  const ovrTarget = clamp(Math.round(rng.normal(peakOvr * 0.7 + 12, 5)), 55, 88);
  const son = generatePlayer({
    position: pos as any,
    ovrTarget,
    age: SON_DRAFT_AGE,
    potBoost: rng.int(8, 18),
    team: null,
    year,
    rng,
    draftYear: year,
  });

  // Inherit some of father's attributes (with regression to mean)
  if (father.attributes && son.attributes) {
    for (const k of Object.keys(father.attributes) as (keyof Attributes)[]) {
      const fv = father.attributes[k];
      const sv = (son.attributes as any)[k];
      if (fv != null && sv != null) {
        const blended = Math.round(0.65 * sv + 0.35 * fv);
        (son.attributes as any)[k] = clamp(blended, 30, 99);
      }
    }
    son.ovr = computeOVR(son.position, son.attributes);
  }

  // Use father's last name and a fresh first name
  son.lastName = father.lastName;
  son.fatherId = father.id;

  // Attach scout grade with a "legacy bump" — scouts believe the genes
  const scoutGrade = clamp(son.ovr + Math.round(rng.normal(2, 5)), 40, 99);
  const projectedRound = clamp(8 - Math.round((scoutGrade - 55) / 5), 1, 7);
  return { ...son, scoutGrade, projectedRound };
}
