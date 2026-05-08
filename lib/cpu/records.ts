import type {
  BoxStat, FranchiseRecord, Game, League, Player, RecordEntry, RecordsBook,
  SeasonStatLine,
} from "@/lib/types";
import { TEAMS } from "@/lib/data/teams";

// =====================================================================
// All-time records (league + per-franchise) and chase notifications.
// =====================================================================

export const RECORD_CATEGORIES = [
  "passYds", "passTd", "rushYds", "rushTd", "rec", "recYds", "recTd",
  "tackles", "sacks", "ints", "fgm",
] as const;

export type RecordCategory = typeof RECORD_CATEGORIES[number];

export const RECORD_LABELS: Record<RecordCategory, string> = {
  passYds: "Passing Yards",
  passTd: "Passing TDs",
  rushYds: "Rushing Yards",
  rushTd: "Rushing TDs",
  rec: "Receptions",
  recYds: "Receiving Yards",
  recTd: "Receiving TDs",
  tackles: "Tackles",
  sacks: "Sacks",
  ints: "Interceptions",
  fgm: "Field Goals Made",
};

export function emptyRecordsBook(): RecordsBook {
  return { career: {}, season: {}, game: {} };
}

export function emptyFranchiseRecord(teamId: string): FranchiseRecord {
  return { teamId, records: emptyRecordsBook(), hof: [], retiredNumbers: [] };
}

/** Compute career total for a single category from history. */
export function careerStat(player: Player, cat: RecordCategory): number {
  let total = 0;
  for (const row of player.history) {
    total += (row as any)[cat] ?? 0;
  }
  return total;
}

/** Update single-game records right after a game ends. */
export function updateGameRecords(league: League, game: Game) {
  if (!game.result) return;
  const allBox = [...game.result.homeBox, ...game.result.awayBox];
  for (const b of allBox) {
    for (const cat of RECORD_CATEGORIES) {
      const v = (b as any)[cat] as number | undefined;
      if (!v || v <= 0) continue;
      const existing = league.records.game[cat];
      if (!existing || v > existing.value) {
        league.records.game[cat] = {
          category: cat, value: v,
          playerId: b.playerId,
          year: league.year, week: game.week,
          teamId: league.players[b.playerId]?.team ?? undefined,
        };
        const player = league.players[b.playerId];
        if (player) {
          announceMilestone(league, player,
            `${player.firstName} ${player.lastName} sets all-time single-game ${RECORD_LABELS[cat]} record (${v})`,
            game.week,
          );
        }
      }
      // Franchise game record
      const teamId = league.players[b.playerId]?.team;
      if (teamId) {
        const fr = ensureFranchise(league, teamId);
        const fGame = fr.records.game[cat];
        if (!fGame || v > fGame.value) {
          fr.records.game[cat] = {
            category: cat, value: v,
            playerId: b.playerId,
            year: league.year, week: game.week,
            teamId,
          };
        }
      }
    }
  }
}

/** Update season + career records at end of season (call from offseason). */
export function rollUpSeasonRecords(league: League) {
  // Single-season — pull from each player's history row this year
  for (const p of Object.values(league.players)) {
    const row = p.history.find((h) => h.year === league.year);
    if (!row) continue;
    for (const cat of RECORD_CATEGORIES) {
      const v = (row as any)[cat] as number | undefined;
      if (!v || v <= 0) continue;
      const existing = league.records.season[cat];
      if (!existing || v > existing.value) {
        league.records.season[cat] = {
          category: cat, value: v, playerId: p.id, year: league.year, teamId: p.team ?? undefined,
        };
        announceMilestone(league, p,
          `${p.firstName} ${p.lastName} sets all-time single-season ${RECORD_LABELS[cat]} record (${v})`,
          0,
        );
      }
      // Franchise season record
      const teamId = p.team;
      if (teamId) {
        const fr = ensureFranchise(league, teamId);
        const fr2 = fr.records.season[cat];
        if (!fr2 || v > fr2.value) {
          fr.records.season[cat] = {
            category: cat, value: v, playerId: p.id, year: league.year, teamId,
          };
        }
      }
    }
  }
  // Career — recompute from history
  for (const p of Object.values(league.players)) {
    if (p.history.length === 0) continue;
    for (const cat of RECORD_CATEGORIES) {
      const v = careerStat(p, cat);
      if (v <= 0) continue;
      const existing = league.records.career[cat];
      if (!existing || v > existing.value) {
        league.records.career[cat] = {
          category: cat, value: v, playerId: p.id, year: league.year, teamId: p.team ?? undefined,
        };
        announceMilestone(league, p,
          `${p.firstName} ${p.lastName} climbs to #1 in all-time ${RECORD_LABELS[cat]} (${v})`,
          0,
        );
      }
    }
  }
}

/** During the season, scan weekly for "X is N from the all-time record" chases. */
export function scanRecordChases(league: League) {
  if (league.phase !== "RegularSeason") return;
  for (const p of Object.values(league.players)) {
    if (!p.team) continue;
    for (const cat of RECORD_CATEGORIES) {
      const career = careerStat(p, cat);
      const target = league.records.career[cat]?.value ?? 0;
      if (target === 0 || career === 0) continue;
      if (target - career > 0 && target - career <= chaseThreshold(cat) && p.id !== league.records.career[cat]?.playerId) {
        // Only announce once per season per player+cat
        const key = `chase${p.id}-${cat}-${league.year}`;
        if (league.news.some((n) => n.id === key)) continue;
        league.news.unshift({
          id: key,
          year: league.year, week: league.week, ts: Date.now(),
          category: "League",
          headline: `${p.firstName} ${p.lastName} is ${target - career} ${RECORD_LABELS[cat].toLowerCase()} from the all-time record`,
          teamId: p.team, playerId: p.id,
        });
      }
    }
  }
}

function chaseThreshold(cat: RecordCategory): number {
  switch (cat) {
    case "passYds": return 800;
    case "passTd": return 8;
    case "rushYds": return 500;
    case "rushTd": return 5;
    case "rec": return 50;
    case "recYds": return 600;
    case "recTd": return 5;
    case "tackles": return 35;
    case "sacks": return 4;
    case "ints": return 3;
    case "fgm": return 6;
  }
}

function announceMilestone(league: League, player: Player, text: string, week: number) {
  if (!player.milestones) player.milestones = [];
  player.milestones.push({ year: league.year, week, text });
  league.news.unshift({
    id: `mile${player.id}-${league.year}-${week}-${text.length}`,
    year: league.year, week, ts: Date.now(),
    category: "League",
    headline: text,
    teamId: player.team ?? undefined,
    playerId: player.id,
  });
}

function ensureFranchise(league: League, teamId: string): FranchiseRecord {
  if (!league.franchises[teamId]) {
    league.franchises[teamId] = emptyFranchiseRecord(teamId);
  }
  return league.franchises[teamId];
}

export function ensureAllFranchises(league: League) {
  for (const t of TEAMS) ensureFranchise(league, t.id);
}
