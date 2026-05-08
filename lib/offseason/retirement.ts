import { RNG } from "@/lib/rng";
import type { League, Player } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";

/**
 * Roll retirements after the season.
 * Old, declining players retire; legends may go to Hall of Fame.
 */
export function processRetirements(league: League) {
  const rng = new RNG(`ret:${league.year}`);
  const retired: Player[] = [];

  for (const p of Object.values(league.players)) {
    if (p.retired) continue;
    let chance = 0;
    if (p.age >= 38) chance = 0.7;
    else if (p.age >= 36) chance = 0.4;
    else if (p.age >= 34) chance = 0.18;
    else if (p.age >= 32) chance = 0.08;
    else if (p.age >= 30 && p.ovr < 70) chance = 0.18;
    else if (p.ovr < 60 && p.age >= 28) chance = 0.10;

    if (rng.chance(chance)) {
      p.retired = true;
      p.team = null;
      p.contract = null;
      p.depth = "Reserve";
      retired.push(p);
    }
  }

  // Hall of Fame eligibility — career awards / longevity
  for (const p of retired) {
    const proBowls = p.history.filter((h) => h.proBowl).length;
    const allPros = p.history.filter((h) => h.allPro).length;
    const mvps = p.history.filter((h) => h.mvp).length;
    const champs = p.history.filter((h) => h.champion).length;
    const score = proBowls * 1 + allPros * 3 + mvps * 8 + champs * 2 + (p.history.length >= 10 ? 4 : 0);
    if (score >= 10) {
      p.hofYear = league.year + 5;
      league.hall.push(p.id);
      league.news.unshift({
        id: `hof${p.id}`,
        year: league.year, week: 0, ts: Date.now(),
        category: "Retire",
        headline: `${p.firstName} ${p.lastName} retires — Hall of Fame lock with ${proBowls} Pro Bowls, ${mvps} MVPs`,
        playerId: p.id,
      });
    } else {
      league.news.unshift({
        id: `ret${p.id}`,
        year: league.year, week: 0, ts: Date.now(),
        category: "Retire",
        headline: `${p.firstName} ${p.lastName} (${p.position}) retires after ${p.history.length} seasons`,
        playerId: p.id,
      });
    }
  }
}
