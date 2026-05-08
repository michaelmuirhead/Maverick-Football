import { RNG } from "@/lib/rng";
import type { League, Player, Position, Team } from "@/lib/types";
import { ROSTER_TARGETS, POSITIONS } from "@/lib/data/positions";
import { generatePlayer } from "./player";
import { TEAMS } from "@/lib/data/teams";
import { clamp } from "@/lib/utils";

interface BuildOpts {
  team: Team;
  year: number;
  rng: RNG;
}

/** Generate a starting roster of 53 for a team based on prestige. */
export function generateTeamRoster({ team, year, rng }: BuildOpts): Player[] {
  const players: Player[] = [];
  // Tier distribution depends on prestige (50–95)
  // Higher prestige -> more stars, fewer scrubs
  const prestigeRoll = (team.prestige - 65) / 30; // ~0..1

  for (const pos of POSITIONS) {
    const target = ROSTER_TARGETS[pos];
    for (let i = 0; i < target; i++) {
      const isStarter = i === 0 || (i === 1 && (pos === "WR" || pos === "OLB" || pos === "DT" || pos === "CB"));
      const ovrTarget = pickOvrTarget(rng, prestigeRoll, pos, i);
      const age = pickAge(rng, isStarter, i);

      const p = generatePlayer({
        position: pos,
        ovrTarget,
        age,
        team: team.id,
        year,
        rng,
      });
      players.push(p);
    }
  }

  // Assign depth roles
  assignDepthChart(players);
  return players;
}

function pickOvrTarget(rng: RNG, prestige: number, pos: Position, slot: number): number {
  // Slot 0/1 are starters; further slots are bench
  // Prestige scales the mean: 70 base, +/- 15 by prestige
  const base = 64 + prestige * 14;
  let slotPenalty = 0;
  if (slot === 0) slotPenalty = 8;          // starter is +8
  else if (slot === 1) slotPenalty = 2;     // backup
  else if (slot === 2) slotPenalty = -3;
  else slotPenalty = -8 - (slot - 2) * 2;   // deep bench
  // Add noise
  const target = clamp(Math.round(base + slotPenalty + rng.normal(0, 4)), 50, 96);
  // QB & K positional spread tweak
  if (pos === "K" || pos === "P") return clamp(Math.round(rng.normal(70, 6)), 55, 92);
  return target;
}

function pickAge(rng: RNG, isStarter: boolean, slot: number): number {
  if (isStarter) {
    return clamp(Math.round(rng.normal(27, 3)), 22, 36);
  }
  if (slot >= 3) {
    // Deep bench leans young
    return clamp(Math.round(rng.normal(24, 2)), 21, 30);
  }
  return clamp(Math.round(rng.normal(26, 3)), 22, 34);
}

export function assignDepthChart(roster: Player[]) {
  // Sort by position, then by OVR; top per position is Starter
  const byPos: Record<string, Player[]> = {};
  for (const p of roster) {
    (byPos[p.position] ||= []).push(p);
  }
  for (const pos in byPos) {
    const arr = byPos[pos].sort((a, b) => b.ovr - a.ovr);
    for (let i = 0; i < arr.length; i++) {
      arr[i].depth = i === 0 ? "Starter" : i <= 2 ? "Backup" : "Reserve";
    }
  }
}

/** Build all 32 rosters and return as a flat record. */
export function generateLeagueRosters(year: number, rng: RNG): Record<string, Player> {
  const all: Record<string, Player> = {};
  for (const team of TEAMS) {
    const roster = generateTeamRoster({ team, year, rng });
    for (const p of roster) all[p.id] = p;
  }
  return all;
}

/** Helper: starters by position group on a team's roster */
export function getStarters(league: League, teamId: string): Player[] {
  return Object.values(league.players).filter((p) => p.team === teamId && p.depth === "Starter");
}

/** Helper: full roster sorted by OVR desc */
export function getRoster(league: League, teamId: string): Player[] {
  return Object.values(league.players)
    .filter((p) => p.team === teamId)
    .sort((a, b) => b.ovr - a.ovr);
}

/** Compute team OVR (avg of starters weighted by importance) */
export function teamOvr(league: League, teamId: string): number {
  const starters = getStarters(league, teamId);
  if (!starters.length) return 50;
  const POS_WEIGHT: Record<string, number> = {
    QB: 4, LT: 1.4, RT: 1.3, WR: 1.2, CB: 1.2, LE: 1.3, RE: 1.3,
    DT: 1.1, OLB: 1.1, MLB: 1.0, TE: 1.0, RB: 1.1, LG: 1.0, RG: 1.0, C: 1.1,
    FS: 1.0, SS: 1.0, K: 0.4, P: 0.3, FB: 0.4,
  };
  let sum = 0, w = 0;
  for (const p of starters) {
    const ww = POS_WEIGHT[p.position] ?? 1;
    sum += p.ovr * ww;
    w += ww;
  }
  return Math.round(sum / Math.max(w, 1));
}

/** Sub-ratings for sim */
export function teamSimRatings(league: League, teamId: string) {
  const roster = getRoster(league, teamId);
  const starter = (pos: string) => roster.find((p) => p.position === pos && p.depth === "Starter");
  const top = (positions: string[], n: number) => {
    return roster.filter((p) => positions.includes(p.position)).slice(0, n);
  };
  const avg = (arr: Player[], get: (p: Player) => number) =>
    arr.length === 0 ? 50 : arr.reduce((a, p) => a + get(p), 0) / arr.length;

  const qb = starter("QB");
  const rbs = top(["RB"], 2);
  const wrs = top(["WR"], 3);
  const tes = top(["TE"], 2);
  const ol = top(["LT","LG","C","RG","RT"], 5);
  const dl = top(["LE","DT","RE"], 4);
  const lb = top(["MLB","OLB"], 3);
  const db = top(["CB","FS","SS"], 4);
  const k = starter("K");
  const p = starter("P");

  return {
    qb: qb?.ovr ?? 50,
    qbId: qb?.id,
    rb: avg(rbs, (p) => p.ovr),
    rbIds: rbs.map((r) => r.id),
    wr: avg(wrs, (p) => p.ovr),
    wrIds: wrs.map((r) => r.id),
    te: avg(tes, (p) => p.ovr),
    teIds: tes.map((r) => r.id),
    ol: avg(ol, (p) => p.ovr),
    olIds: ol.map((r) => r.id),
    dl: avg(dl, (p) => p.ovr),
    dlIds: dl.map((r) => r.id),
    lb: avg(lb, (p) => p.ovr),
    lbIds: lb.map((r) => r.id),
    db: avg(db, (p) => p.ovr),
    dbIds: db.map((r) => r.id),
    kOvr: k?.ovr ?? 70, kId: k?.id,
    pOvr: p?.ovr ?? 70, pId: p?.id,
    overall:
      ((qb?.ovr ?? 50) * 0.18) +
      (avg(rbs, (p) => p.ovr) * 0.07) +
      (avg(wrs, (p) => p.ovr) * 0.10) +
      (avg(tes, (p) => p.ovr) * 0.04) +
      (avg(ol, (p) => p.ovr) * 0.13) +
      (avg(dl, (p) => p.ovr) * 0.14) +
      (avg(lb, (p) => p.ovr) * 0.10) +
      (avg(db, (p) => p.ovr) * 0.18) +
      (((k?.ovr ?? 70) + (p?.ovr ?? 70)) / 2) * 0.06,
  };
}
