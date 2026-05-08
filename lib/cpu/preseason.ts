import { RNG } from "@/lib/rng";
import type { CampNote, League, Player } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { getRoster } from "@/lib/gen/roster";
import { clamp } from "@/lib/utils";

// =====================================================================
// Preseason camp layer: position battles, undrafted gems, breakout news.
// Light flavor — no actual preseason games are simulated.
// =====================================================================

export function runPreseasonCamps(league: League) {
  const rng = new RNG(`camp:${league.year}`);
  league.preseasonNotes = [];

  for (const team of TEAMS) {
    const roster = getRoster(league, team.id);

    // 1) Camp standout — a backup / rookie has a great camp (+2 OVR)
    const candidates = roster.filter((p) => p.depth !== "Starter" && p.age <= 25 && p.ovr >= 65 && p.ovr <= 80);
    if (candidates.length && rng.chance(0.7)) {
      const standout = rng.pick(candidates);
      const bump = rng.int(1, 3);
      standout.ovr = clamp(standout.ovr + bump, 40, 99);
      const note: CampNote = {
        id: `camp-${standout.id}`,
        playerId: standout.id,
        team: team.id,
        text: `${standout.firstName} ${standout.lastName} (${standout.position}) impressing in camp — pushing for more snaps`,
        ovrChange: bump,
      };
      league.preseasonNotes.push(note);
    }

    // 2) Undrafted gem — UDFA or low-OVR rookie surprises (5% per team)
    const udfas = roster.filter((p) => !p.draftRound && p.draftYear === league.year);
    if (udfas.length && rng.chance(0.20)) {
      const gem = rng.pick(udfas);
      const bump = rng.int(2, 5);
      gem.ovr = clamp(gem.ovr + bump, 40, 99);
      gem.pot = clamp(gem.pot + 4, 40, 99);
      const note: CampNote = {
        id: `gem-${gem.id}`,
        playerId: gem.id,
        team: team.id,
        text: `Undrafted rookie ${gem.firstName} ${gem.lastName} (${gem.position}) emerges as camp surprise`,
        ovrChange: bump,
      };
      league.preseasonNotes.push(note);
    }

    // 3) Position battle — flag a competitive starting spot
    const positions = ["QB", "RB", "WR", "CB", "LE"] as const;
    const pos = rng.pick(positions);
    const atPos = roster.filter((p) => p.position === pos).slice(0, 3);
    if (atPos.length >= 2 && Math.abs(atPos[0].ovr - atPos[1].ovr) <= 4 && rng.chance(0.5)) {
      const note: CampNote = {
        id: `battle-${team.id}-${pos}-${league.year}`,
        playerId: atPos[0].id,
        team: team.id,
        text: `${TEAMS_BY_ID[team.id].name}: ${pos} position battle between ${atPos[0].lastName} and ${atPos[1].lastName} entering Week 1`,
      };
      league.preseasonNotes.push(note);
    }
  }

  // Top 6 notes get news headlines so they show up on Hub
  for (const n of league.preseasonNotes.slice(0, 6)) {
    league.news.unshift({
      id: `camp-news-${n.id}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "League",
      headline: `🏈 ${n.text}`,
      teamId: n.team,
      playerId: n.playerId,
    });
  }
}
