import type { BoxStat, Game, League } from "@/lib/types";

// =====================================================================
// Player chemistry: QB ↔ receiver pairs accumulate games together. Long
// partnerships earn a small completion bonus. Trades reset chemistry.
// =====================================================================

export const MAX_CHEMISTRY_BONUS = 0.04;       // +4% completion ceiling

/** Increment shared-game counters for QB↔receiver pairs after a game. */
export function bumpChemistryFromGame(league: League, game: Game) {
  if (!game.result) return;
  for (const box of [game.result.homeBox, game.result.awayBox]) {
    const qbBox = box.find((b) => (b.passAtt ?? 0) > 0);
    if (!qbBox) continue;
    const qb = league.players[qbBox.playerId];
    if (!qb) continue;
    if (!qb.chemistry) qb.chemistry = {};
    for (const recBox of box) {
      if ((recBox.tgt ?? 0) === 0) continue;
      if (recBox.playerId === qb.id) continue;
      const rec = league.players[recBox.playerId];
      if (!rec) continue;
      qb.chemistry[recBox.playerId] = (qb.chemistry[recBox.playerId] ?? 0) + 1;
      // Mirror: receiver also tracks chemistry with the QB (lighter weight)
      if (!rec.chemistry) rec.chemistry = {};
      rec.chemistry[qb.id] = (rec.chemistry[qb.id] ?? 0) + 1;
    }
  }
}

/** Returns chemistry bonus (additive) for a QB→receiver pair on a given throw. */
export function chemistryBonus(league: League, qbId: string, receiverId: string): number {
  const qb = league.players[qbId];
  if (!qb?.chemistry) return 0;
  const games = qb.chemistry[receiverId] ?? 0;
  // 16 games shared = max bonus; below that scale linearly
  return Math.min(MAX_CHEMISTRY_BONUS, games * 0.0025);
}

/** When players move teams, chemistry bonds are kept in data but functionally lost. */
export function chemistryActiveBonus(league: League, qbId: string, receiverId: string): number {
  const qb = league.players[qbId];
  const rec = league.players[receiverId];
  if (!qb || !rec) return 0;
  if (qb.team !== rec.team) return 0;
  return chemistryBonus(league, qbId, receiverId);
}

/** Format chemistry summary for player profile (top 3 partners). */
export function topChemistry(league: League, playerId: string): { partnerId: string; games: number; partnerName: string }[] {
  const p = league.players[playerId];
  if (!p?.chemistry) return [];
  return Object.entries(p.chemistry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([partnerId, games]) => {
      const partner = league.players[partnerId];
      return { partnerId, games, partnerName: partner ? `${partner.firstName} ${partner.lastName}` : "—" };
    });
}
