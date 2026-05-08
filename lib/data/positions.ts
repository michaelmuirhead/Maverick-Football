import type { Position, PositionGroup } from "@/lib/types";

export const POSITION_GROUP: Record<Position, PositionGroup> = {
  QB: "QB",
  RB: "RB", FB: "RB",
  WR: "WR",
  TE: "TE",
  LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL",
  LE: "DL", DT: "DL", RE: "DL",
  MLB: "LB", OLB: "LB",
  CB: "DB", FS: "DB", SS: "DB",
  K: "ST", P: "ST",
};

// Roster construction targets (53-man)
export const ROSTER_TARGETS: Record<Position, number> = {
  QB: 3,
  RB: 4, FB: 1,
  WR: 6,
  TE: 3,
  LT: 2, LG: 2, C: 2, RG: 2, RT: 2,
  LE: 2, DT: 4, RE: 2,
  MLB: 2, OLB: 4,
  CB: 5, FS: 2, SS: 2,
  K: 1, P: 1,
}; // = 53

export const POSITIONS: Position[] = Object.keys(ROSTER_TARGETS) as Position[];

export const POSITION_LABEL: Record<Position, string> = {
  QB: "Quarterback", RB: "Running Back", FB: "Fullback",
  WR: "Wide Receiver", TE: "Tight End",
  LT: "Left Tackle", LG: "Left Guard", C: "Center", RG: "Right Guard", RT: "Right Tackle",
  LE: "Left End", DT: "Defensive Tackle", RE: "Right End",
  MLB: "Middle Linebacker", OLB: "Outside Linebacker",
  CB: "Cornerback", FS: "Free Safety", SS: "Strong Safety",
  K: "Kicker", P: "Punter",
};

// Group → which positions belong, for depth chart UI ordering
export const GROUP_ORDER: PositionGroup[] = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "ST"];
export const GROUP_LABEL: Record<PositionGroup, string> = {
  QB: "Quarterbacks", RB: "Running Backs", WR: "Wide Receivers", TE: "Tight Ends",
  OL: "Offensive Line", DL: "Defensive Line", LB: "Linebackers", DB: "Defensive Backs", ST: "Special Teams",
};

// Body templates: [meanH, sdH, meanW, sdW] — inches and pounds
export const BODY_TEMPLATE: Record<Position, [number, number, number, number]> = {
  QB:  [75, 1.5, 220, 12],
  RB:  [70, 1.5, 215, 12],
  FB:  [72, 1.2, 240, 10],
  WR:  [72, 1.8, 200, 12],
  TE:  [76, 1.4, 250, 12],
  LT:  [78, 1.0, 315, 14],
  LG:  [76, 1.0, 320, 14],
  C:   [75, 1.0, 305, 12],
  RG:  [76, 1.0, 320, 14],
  RT:  [78, 1.0, 315, 14],
  LE:  [76, 1.5, 270, 16],
  DT:  [74, 1.2, 320, 18],
  RE:  [76, 1.5, 270, 16],
  MLB: [73, 1.4, 240, 12],
  OLB: [74, 1.4, 245, 14],
  CB:  [71, 1.5, 195, 10],
  FS:  [72, 1.2, 205, 10],
  SS:  [72, 1.2, 215, 10],
  K:   [72, 1.5, 195, 12],
  P:   [73, 1.5, 210, 12],
};

// Attribute weights to compute OVR. Each position weighs attributes differently.
// Sum of weights ≈ 1.0
export const OVR_WEIGHTS: Record<Position, Partial<Record<keyof import("@/lib/types").Attributes, number>>> = {
  QB:  { thp: 0.16, tha: 0.30, awr: 0.22, tup: 0.12, pac: 0.08, agi: 0.04, spd: 0.04, sta: 0.04 },
  RB:  { spd: 0.16, acc: 0.10, agi: 0.10, btk: 0.13, ela: 0.10, vis: 0.12, car: 0.08, str: 0.08, awr: 0.07, cat: 0.06 },
  FB:  { rbk: 0.30, str: 0.20, awr: 0.18, btk: 0.10, cat: 0.10, spd: 0.06, agi: 0.06 },
  WR:  { spd: 0.16, acc: 0.10, agi: 0.10, cat: 0.16, rte: 0.16, rls: 0.10, awr: 0.10, jmp: 0.08, str: 0.04 },
  TE:  { cat: 0.18, rte: 0.14, rbk: 0.14, pbk: 0.06, str: 0.10, spd: 0.10, awr: 0.12, agi: 0.08, jmp: 0.08 },
  LT:  { pbk: 0.34, rbk: 0.20, str: 0.16, awr: 0.14, agi: 0.08, ibl: 0.08 },
  LG:  { rbk: 0.30, pbk: 0.22, str: 0.20, awr: 0.14, ibl: 0.08, agi: 0.06 },
  C:   { rbk: 0.24, pbk: 0.22, awr: 0.22, str: 0.16, ibl: 0.08, agi: 0.08 },
  RG:  { rbk: 0.30, pbk: 0.22, str: 0.20, awr: 0.14, ibl: 0.08, agi: 0.06 },
  RT:  { pbk: 0.30, rbk: 0.22, str: 0.18, awr: 0.14, agi: 0.08, ibl: 0.08 },
  LE:  { pmv: 0.18, fmv: 0.20, bsh: 0.14, str: 0.14, tak: 0.10, awr: 0.10, acc: 0.08, spd: 0.06 },
  DT:  { pmv: 0.22, bsh: 0.18, str: 0.22, tak: 0.12, awr: 0.10, fmv: 0.10, acc: 0.06 },
  RE:  { pmv: 0.18, fmv: 0.20, bsh: 0.14, str: 0.14, tak: 0.10, awr: 0.10, acc: 0.08, spd: 0.06 },
  MLB: { tak: 0.20, awr: 0.18, str: 0.12, spd: 0.10, hpw: 0.10, pcv: 0.08, zcv: 0.10, bsh: 0.06, agi: 0.06 },
  OLB: { tak: 0.16, pmv: 0.14, fmv: 0.10, spd: 0.10, str: 0.10, awr: 0.12, hpw: 0.10, pcv: 0.08, zcv: 0.10 },
  CB:  { spd: 0.18, acc: 0.10, agi: 0.10, pcv: 0.18, zcv: 0.12, prc: 0.10, awr: 0.10, jmp: 0.06, cat: 0.06 },
  FS:  { spd: 0.14, awr: 0.16, zcv: 0.18, pcv: 0.10, tak: 0.10, hpw: 0.06, agi: 0.10, jmp: 0.08, acc: 0.08 },
  SS:  { tak: 0.16, hpw: 0.14, awr: 0.14, str: 0.10, zcv: 0.12, pcv: 0.10, spd: 0.10, agi: 0.08, jmp: 0.06 },
  K:   { kpw: 0.40, kac: 0.50, awr: 0.10 },
  P:   { kpw: 0.50, kac: 0.40, awr: 0.10 },
};
