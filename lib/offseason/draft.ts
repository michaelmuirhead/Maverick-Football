import { RNG } from "@/lib/rng";
import type { DraftPick, DraftProspect, League, Player, Position } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { generatePlayer } from "@/lib/gen/player";
import { POSITION_GROUP } from "@/lib/data/positions";
import { assignDepthChart, getRoster } from "@/lib/gen/roster";
import { positionPriority, computeTeamPhase, teamScoutGrade } from "@/lib/cpu/strategy";
import { personalityFor, schemeFit } from "@/lib/cpu/personalities";
import { clamp } from "@/lib/utils";

const ROUNDS = 7;

/** Build the next year's draft picks (1-7 rounds * 32 teams) ordered by reverse standings, playoff teams last. */
export function buildDraftOrder(league: League, year: number): DraftPick[] {
  const playoffSeeds = new Map<string, number>();
  const playoffGames = league.schedule.filter((g) => g.year === year - 1 && (g.week ?? 0) >= 19 && g.played);
  for (const g of playoffGames) {
    const w = g.result!.homeScore > g.result!.awayScore ? g.home : g.away;
    const round = g.playoffRound;
    const score = round === "SB" ? 30 : round === "CONF" ? 20 : round === "DIV" ? 10 : 5;
    playoffSeeds.set(w, Math.max(playoffSeeds.get(w) ?? 0, score));
  }

  const all = TEAMS.map((t) => {
    const s = league.standings[t.id];
    const wp = (s.w + s.t * 0.5) / Math.max(s.w + s.l + s.t, 1);
    return {
      id: t.id, wp, pf: s.pf, pa: s.pa,
      playoff: playoffSeeds.get(t.id) ?? 0,
    };
  });
  all.sort((a, b) => {
    if (a.playoff !== b.playoff) return a.playoff - b.playoff;
    if (a.wp !== b.wp) return a.wp - b.wp;
    return (a.pf - a.pa) - (b.pf - b.pa);
  });

  const picks: DraftPick[] = [];
  for (let r = 1; r <= ROUNDS; r++) {
    let p = 1;
    for (const team of all) {
      picks.push({ year, round: r, pick: p, originalTeam: team.id, currentTeam: team.id });
      p++;
    }
  }
  return picks;
}

/** Generate a fresh draft class — 260 prospects with realistic positional distribution */
export function generateDraftClass(year: number, rng: RNG): DraftProspect[] {
  const prospects: DraftProspect[] = [];
  const dist: Record<Position, number> = {
    QB: 14, RB: 22, FB: 2, WR: 38, TE: 14,
    LT: 12, LG: 12, C: 8, RG: 12, RT: 12,
    LE: 14, DT: 22, RE: 14,
    MLB: 10, OLB: 18,
    CB: 26, FS: 10, SS: 10,
    K: 4, P: 4,
  };
  for (const [posStr, n] of Object.entries(dist)) {
    const pos = posStr as Position;
    for (let i = 0; i < n; i++) {
      const tierRoll = rng.next();
      let ovrTarget = 60;
      let pot = 65;
      if (tierRoll < 0.05) { ovrTarget = clamp(Math.round(rng.normal(78, 4)), 70, 88); pot = clamp(Math.round(rng.normal(92, 3)), 85, 99); }
      else if (tierRoll < 0.20) { ovrTarget = clamp(Math.round(rng.normal(72, 4)), 65, 82); pot = clamp(Math.round(rng.normal(85, 4)), 78, 95); }
      else if (tierRoll < 0.55) { ovrTarget = clamp(Math.round(rng.normal(65, 4)), 55, 75); pot = clamp(Math.round(rng.normal(76, 5)), 68, 88); }
      else { ovrTarget = clamp(Math.round(rng.normal(58, 4)), 48, 68); pot = clamp(Math.round(rng.normal(68, 5)), 60, 80); }

      const age = clamp(Math.round(rng.normal(22, 1)), 20, 25);
      const player = generatePlayer({
        position: pos, ovrTarget, age,
        potBoost: pot - ovrTarget,
        team: null, year, rng, draftYear: year,
      });
      const scoutGrade = clamp(player.ovr + Math.round(rng.normal(0, 6)), 40, 99);
      const projectedRound = clamp(8 - Math.round((scoutGrade - 55) / 5), 1, 7);
      prospects.push({ ...player, scoutGrade, projectedRound });
    }
  }
  return prospects.sort((a, b) => b.scoutGrade - a.scoutGrade);
}

/**
 * Run the full draft. CPU teams pick using their personality:
 *   - Compute team-specific scout grade (scoutAccuracy noise)
 *   - Compute "value" = team-grade × (1 + needBoost) × schemeFit × personality biases
 *   - BPA gap: if best-graded available is 7+ above next-best at a non-need position,
 *     consider taking BPA over need
 *   - BoomBust: weight POT more, accept variance
 *   - Safe: weight current OVR
 *   - Round-aware: round 1 leans toward elite trait/grade, late rounds lean to fit
 */
export function runDraft(league: League) {
  const rng = new RNG(`draft:${league.year}`);
  const picks = league.draftPicks.filter((dp) => dp.year === league.year && !dp.used);
  picks.sort((a, b) => a.round - b.round || a.pick - b.pick);

  for (const pick of picks) {
    const team = TEAMS_BY_ID[pick.currentTeam];
    const personality = personalityFor(team.id);
    const phase = computeTeamPhase(league, team.id);
    const need = positionPriority(league, team.id);

    const available = league.draftClass.filter((p) => !p.team && !p.retired);
    if (!available.length) break;

    // Score every available prospect from this team's perspective
    const scored = available.map((prospect) => {
      const teamGrade = teamScoutGrade(league, team.id, prospect, prospect.scoutGrade);
      const fit = schemeFit(team, prospect.position);
      const positionalNeed = need[prospect.position] ?? 0;
      // Need bump: stronger early-round (where contenders draft for fit), weaker late
      const needWeight = pick.round <= 2 ? 1.4 : pick.round <= 4 ? 1.0 : 0.7;
      const needBoost = positionalNeed * needWeight;

      // OVR vs POT weight depends on personality
      let baseQuality;
      if (personality.draftStyle === "BoomBust") {
        // chase ceilings
        baseQuality = teamGrade * 0.55 + prospect.pot * 0.45;
      } else if (personality.draftStyle === "Safe") {
        baseQuality = teamGrade * 0.85 + prospect.ovr * 0.15;
      } else {
        baseQuality = teamGrade * 0.75 + prospect.pot * 0.25;
      }

      // Phase bias
      let phaseMod = 1.0;
      if (phase === "WinNow" && prospect.pot - prospect.ovr > 12) phaseMod = 0.92;   // contenders less interested in projects
      if (phase === "Rebuild" && prospect.pot - prospect.ovr > 15) phaseMod = 1.06;  // rebuilders love upside

      // Style biases (Trenches/Skill/etc.)
      const grp = POSITION_GROUP[prospect.position];
      let styleBoost = 1.0;
      if (personality.draftStyle === "Trenches" && (grp === "OL" || grp === "DL")) styleBoost = 1.10;
      if (personality.draftStyle === "Skill" && (grp === "QB" || grp === "WR" || grp === "RB" || grp === "TE")) styleBoost = 1.10;

      // Position scarcity premium for QB
      let scarcity = 1.0;
      if (prospect.position === "QB" && positionalNeed > 4) scarcity = 1.20;

      // Final score
      const score = baseQuality * phaseMod * styleBoost * scarcity * fit + needBoost;

      return { p: prospect, score, teamGrade, fit, positionalNeed, baseQuality };
    });

    scored.sort((a, b) => b.score - a.score);
    const top10 = scored.slice(0, 10);

    // BPA override: if the team's draft style is "BPA" and the top-graded prospect
    // has a much higher base quality than the top need-fit, take BPA.
    let chosen = top10[0];
    if (personality.draftStyle === "BPA") {
      const topByQuality = [...scored].sort((a, b) => b.baseQuality - a.baseQuality)[0];
      if (topByQuality && topByQuality.baseQuality - top10[0].baseQuality >= 5) {
        chosen = topByQuality;
      }
    }

    // Inject controlled randomness — top-3 weighted pick (less random for high-accuracy orgs)
    const accuracy = personality.scoutAccuracy;
    const noiseTopN = accuracy >= 0.82 ? 2 : accuracy >= 0.7 ? 3 : 4;
    const candidates = top10.slice(0, noiseTopN);
    if (!candidates.includes(chosen)) candidates[0] = chosen;
    const winner = rng.weighted(candidates, candidates.map((_, i) => candidates.length - i)).p;

    // Sign
    const slotAav = rookieSlotAav(pick.round, pick.pick);
    winner.team = team.id;
    winner.draftRound = pick.round;
    winner.draftPick = pick.pick;
    winner.contract = {
      years: pick.round === 1 ? 4 : 3,
      aav: slotAav,
      signedYear: league.year,
      signingBonus: slotAav * 0.6,
    };
    pick.used = true;
    pick.playerId = winner.id;

    league.players[winner.id] = winner as unknown as Player;

    // Story spin: was this a reach, value, or surprise?
    const projOverall = (winner.projectedRound - 1) * 32 + 16;
    const overall = (pick.round - 1) * 32 + pick.pick;
    let spin = "";
    if (overall <= projOverall - 25) spin = " (REACH alert)";
    else if (overall >= projOverall + 25) spin = " (steal!)";
    else if (top10[0].p.id !== winner.id) spin = " (surprise pick)";

    league.news.unshift({
      id: `dr${winner.id}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "Draft",
      headline: `R${pick.round}P${pick.pick}: ${TEAMS_BY_ID[team.id].name} select ${winner.firstName} ${winner.lastName} (${winner.position}, ${winner.college})${spin}`,
      teamId: team.id, playerId: winner.id,
    });
  }

  // Refresh depth charts after draft
  for (const team of TEAMS) {
    const roster = getRoster(league, team.id);
    assignDepthChart(roster);
  }

  // UDFAs — top remaining 60 sign with teams that have actual need at the position
  const udfas = league.draftClass.filter((p) => !p.team).slice(0, 60);
  for (const udfa of udfas) {
    // Find a team with a real need
    const candidates = TEAMS
      .map((t) => ({ t, score: positionPriority(league, t.id)[udfa.position] ?? 0 }))
      .filter((x) => x.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    const team = candidates.length ? rng.pick(candidates).t : rng.pick(TEAMS);
    udfa.team = team.id;
    udfa.contract = { years: 1, aav: 0.8, signedYear: league.year, signingBonus: 0.05 };
    league.players[udfa.id] = udfa as unknown as Player;
  }

  // Final depth-chart pass after UDFAs
  for (const team of TEAMS) {
    const roster = getRoster(league, team.id);
    assignDepthChart(roster);
  }
}

/** Approximate rookie slotted AAV (millions). */
function rookieSlotAav(round: number, pick: number): number {
  const overall = (round - 1) * 32 + pick;
  if (overall === 1) return 10.0;
  if (overall <= 5) return 8.0;
  if (overall <= 10) return 6.5;
  if (overall <= 32) return 4.0 - (overall - 10) * 0.08;
  if (overall <= 64) return 1.8;
  if (overall <= 100) return 1.2;
  if (overall <= 160) return 1.0;
  return 0.85;
}
