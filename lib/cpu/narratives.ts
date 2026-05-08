import { RNG } from "@/lib/rng";
import type { League, Player } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { computeTeamPhase } from "./strategy";

// =====================================================================
// In-season narrative news: hot rookie watch + mid-season trade rumors.
// Emitted from simWeek so the news feed stays alive between games.
// =====================================================================

// ---------------- Hot rookie watch ----------------

/** From week 4+, surface ascending rookies with surprising stats. */
export function watchHotRookies(league: League) {
  if (league.phase !== "RegularSeason" || league.week < 4) return;
  const rng = new RNG(`hotrook:${league.year}:${league.week}`);
  const rookies = Object.values(league.players)
    .filter((p) => p.draftYear === league.year && p.team && !p.retired);
  if (!rookies.length) return;

  const scored = rookies.map((p) => {
    const row = p.history.find((h) => h.year === league.year);
    if (!row) return { p, score: 0 };
    const score =
      (row.passYds ?? 0) * 0.04 +
      (row.passTd ?? 0) * 6 +
      (row.rushYds ?? 0) * 0.07 +
      (row.rushTd ?? 0) * 6 +
      (row.recYds ?? 0) * 0.07 +
      (row.recTd ?? 0) * 6 +
      (row.tackles ?? 0) * 0.5 +
      (row.sacks ?? 0) * 4 +
      (row.ints ?? 0) * 5;
    return { p, score };
  }).filter((x) => x.score > 30).sort((a, b) => b.score - a.score);

  if (!scored.length) return;
  // Pick top 1-2 with bias toward surprises (low-round picks who are producing)
  const candidate = rng.weighted(
    scored.slice(0, 5),
    scored.slice(0, 5).map((x, i) => 5 - i + (x.p.draftRound && x.p.draftRound >= 4 ? 2 : 0)),
  );
  const p = candidate.p;
  // Don't repeat for the same player in the same season
  const key = `hotrook-${p.id}-${league.year}`;
  if (league.news.some((n) => n.id === key)) return;

  const flavor = p.draftRound && p.draftRound >= 4
    ? "late-round gem"
    : p.draftRound === undefined
      ? "undrafted surprise"
      : "consensus rising star";
  league.news.unshift({
    id: key,
    year: league.year, week: league.week, ts: Date.now(),
    category: "League",
    headline: `🔥 Hot rookie watch: ${p.firstName} ${p.lastName} (${p.position}, ${TEAMS_BY_ID[p.team!].abbr}) emerges as ${flavor}`,
    teamId: p.team ?? undefined, playerId: p.id,
  });
}

// ---------------- Mid-season trade rumors ----------------

/** Weeks 5-8: speculative trade rumors. May or may not pan out. */
export function emitTradeRumors(league: League) {
  if (league.phase !== "RegularSeason") return;
  if (league.week < 5 || league.week > 8) return;
  const rng = new RNG(`rumor:${league.year}:${league.week}`);
  if (!rng.chance(0.8)) return;

  // Pick a struggling team
  const struggling = TEAMS
    .map((t) => {
      const s = league.standings[t.id];
      const wp = (s.w + s.t * 0.5) / Math.max(s.w + s.l + s.t, 1);
      return { t, wp };
    })
    .filter((x) => x.wp < 0.4)
    .sort((a, b) => a.wp - b.wp)
    .slice(0, 8);
  if (!struggling.length) return;

  const seller = rng.pick(struggling).t;
  // Pick a star on the seller team
  const stars = Object.values(league.players)
    .filter((p) => p.team === seller.id && !p.retired && p.ovr >= 82 && p.age >= 28);
  if (!stars.length) return;
  const target: Player = rng.pick(stars);

  // Pick a buyer — Win-Now contender
  const contenders = TEAMS
    .filter((t) => t.id !== seller.id && computeTeamPhase(league, t.id) === "WinNow")
    .map((t) => ({ t, wp: (league.standings[t.id].w + league.standings[t.id].t * 0.5) / Math.max(league.standings[t.id].w + league.standings[t.id].l + league.standings[t.id].t, 1) }))
    .sort((a, b) => b.wp - a.wp)
    .slice(0, 6);
  if (!contenders.length) return;
  const buyer = rng.pick(contenders).t;

  const flavors = [
    `reportedly listening to offers on`,
    `said to be open to dealing`,
    `gauging the market on`,
    `fielding calls about`,
  ];
  const flavor = rng.pick(flavors);
  const key = `rumor-${target.id}-${league.year}-${league.week}`;
  if (league.news.some((n) => n.id === key)) return;
  league.news.unshift({
    id: key,
    year: league.year, week: league.week, ts: Date.now(),
    category: "Trade",
    headline: `📰 RUMOR: ${seller.abbr} ${flavor} ${target.firstName} ${target.lastName} (${target.position}, ${target.ovr} OVR). ${buyer.abbr} mentioned as a suitor.`,
    teamId: seller.id, playerId: target.id,
  });
}
