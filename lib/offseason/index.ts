import type { League } from "@/lib/types";
import { RNG } from "@/lib/rng";
import { pickAwards } from "./awards";
import { processRetirements } from "./retirement";
import { progressPlayers } from "./progression";
import { processFreeAgency } from "./freeAgency";
import { buildDraftOrder, generateDraftClass, runDraft } from "./draft";
import { buildSchedule } from "@/lib/gen/schedule";
import { emptyStandings } from "@/lib/sim/season";

/**
 * Run a full offseason in one go (used when "Sim to next season").
 * In UI we step through each phase so user can interact (sign FAs, draft).
 */
export function runFullOffseason(league: League) {
  // 1) Awards
  const awards = pickAwards(league);
  league.awards.push(...awards);

  // 2) Retirements
  processRetirements(league);

  // 3) Progression / regression
  progressPlayers(league);

  // 4) Generate next draft order + class
  const nextYear = league.year + 1;
  league.draftPicks = league.draftPicks.filter((dp) => dp.year !== nextYear);
  league.draftPicks.push(...buildDraftOrder(league, nextYear));
  league.draftClass = generateDraftClass(nextYear, new RNG(`class:${nextYear}`));

  // 5) Free agency
  processFreeAgency(league);

  // 6) Draft
  league.year = nextYear;
  runDraft(league);

  // 7) New season setup
  league.standings = emptyStandings();
  league.schedule = league.schedule.filter((g) => g.year < league.year);
  league.schedule.push(...buildSchedule(league.year, new RNG(`sch:${league.year}`)));

  league.phase = "RegularSeason";
  league.week = 1;

  league.news.unshift({
    id: `season${league.year}`,
    year: league.year, week: 0, ts: Date.now(),
    category: "League",
    headline: `${league.year} season is underway`,
  });
}

export { pickAwards, processRetirements, progressPlayers, processFreeAgency, runDraft, buildDraftOrder, generateDraftClass };
