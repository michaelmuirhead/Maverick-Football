import { RNG } from "@/lib/rng";
import type { FreeAgent, League, Player } from "@/lib/types";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { computeMarketValue } from "@/lib/gen/player";
import { getRoster, assignDepthChart } from "@/lib/gen/roster";
import { ROSTER_TARGETS, POSITION_GROUP } from "@/lib/data/positions";
import { computeTeamPhase, valueToTeam, maxBid, positionPriority } from "@/lib/cpu/strategy";
import { personalityFor } from "@/lib/cpu/personalities";
import { clamp } from "@/lib/utils";

/**
 * Smart free agency:
 *  1. Expire contracts → build FA pool with sensible asks
 *  2. Multi-round bidding war: each team identifies its top targets,
 *     submits a max-bid offer, FA chooses best (highest AAV with prestige
 *     tiebreaker for win-now teams). Repeat until offers dry up.
 *  3. Late-stage VFA pool: low-quality FAs sign cheap or retire
 */
export function processFreeAgency(league: League) {
  const rng = new RNG(`fa:${league.year}`);

  // 1) Expire contracts → FA pool
  const newFAs: FreeAgent[] = [];
  for (const p of Object.values(league.players)) {
    if (p.retired) continue;
    if (!p.contract) {
      if (!p.team) newFAs.push(makeFA(p));
      continue;
    }
    p.contract.years -= 1;
    if (p.contract.years <= 0) {
      p.team = null;
      p.contract = null;
      p.depth = "Reserve";
      newFAs.push(makeFA(p));
    }
  }
  league.freeAgents = newFAs;

  // 2) Bidding rounds — top players first
  const ROUNDS = 8;
  for (let round = 0; round < ROUNDS; round++) {
    const signed = runBiddingRound(league, rng, round);
    if (signed === 0) break;
  }

  // 3) Cleanup: very low-OVR FAs retire after FA closes
  for (const fa of league.freeAgents) {
    const p = league.players[fa.playerId];
    if (!p) continue;
    if (p.ovr < 65 && rng.chance(0.45)) {
      p.retired = true;
      league.news.unshift({
        id: `unret${p.id}`,
        year: league.year, week: 0, ts: Date.now(),
        category: "Retire",
        headline: `${p.firstName} ${p.lastName} (${p.position}) retires unsigned after free agency`,
        playerId: p.id,
      });
    }
  }
  league.freeAgents = league.freeAgents.filter((f) => {
    const p = league.players[f.playerId];
    return p && !p.retired && !p.team;
  });

  // Reassign depth charts on every team after FA shuffles things
  for (const team of TEAMS) {
    const roster = Object.values(league.players).filter((pp) => pp.team === team.id);
    assignDepthChart(roster);
  }
}

function makeFA(p: Player): FreeAgent {
  const ask = computeMarketValue(p.position, p.ovr, p.age);
  const askYears = p.age >= 32 ? 1 : p.age >= 30 ? 2 : Math.min(4, Math.max(2, Math.round((p.ovr - 60) / 8)));
  return { playerId: p.id, askYears, askAav: ask, interest: {} };
}

interface Offer {
  teamId: string;
  aav: number;
  years: number;
  prestige: number;       // tiebreaker
  attractiveness: number; // composite (aav * prestige bias)
}

/**
 * One bidding round:
 *  - Sort FAs by ovr descending (top players generate most interest first).
 *  - For each FA, every team computes a max bid; if >= asking floor, submits offer.
 *  - FA accepts the most attractive offer.
 */
function runBiddingRound(league: League, rng: RNG, round: number): number {
  let signedThisRound = 0;
  const fas = [...league.freeAgents]
    .map((f) => ({ f, p: league.players[f.playerId] }))
    .filter(({ p }) => p && !p.retired && !p.team)
    .sort((a, b) => b.p.ovr - a.p.ovr);

  for (const { f, p } of fas) {
    const offers: Offer[] = [];

    for (const team of TEAMS) {
      const capUsed = currentTeamPayroll(league, team.id);
      const capRoom = team.cap - capUsed;
      if (capRoom < 0.6) continue;

      const myValue = valueToTeam(league, team.id, p);
      const myMax = maxBid(league, team.id, p, capRoom);
      const need = positionPriority(league, team.id)[p.position] ?? 0;

      // Don't bother if value-to-team falls way below ask
      if (myValue < f.askAav * 0.6) continue;

      // Won't bid above own ceiling; but won't drop below ask too much either
      // Round 0 (open market): everyone bids close to value. Later rounds: aggressive teams steal at lower prices.
      const offerAav = clamp(
        Math.min(myMax, myValue * (round === 0 ? 0.92 : 0.78 - round * 0.04)),
        0.6,
        myMax,
      );
      // Skip absurdly low offers
      if (offerAav < f.askAav * 0.45) continue;

      const personality = personalityFor(team.id);
      const phase = computeTeamPhase(league, team.id);
      const prestige = TEAMS_BY_ID[team.id].prestige + (phase === "WinNow" ? 6 : phase === "Rebuild" ? -4 : 0);

      // Attractiveness — money first, prestige modulates
      const attractiveness = offerAav * 10 + prestige * 0.4 + need * 0.5 + (personality.faStyle === "AllIn" ? 2 : 0);

      const years = p.age >= 32 ? 1 : Math.min(f.askYears, personality.faStyle === "AllIn" ? f.askYears + 1 : f.askYears);

      offers.push({ teamId: team.id, aav: offerAav, years, prestige, attractiveness });
    }

    if (!offers.length) continue;

    // Player evaluates: highest attractiveness wins. Add a bit of randomness.
    offers.sort((a, b) => (b.attractiveness + rng.float(-1, 1)) - (a.attractiveness + rng.float(-1, 1)));
    const winner = offers[0];

    // Lower the floor — sometimes the player rejects (top FAs in round 0 want a real bidding war)
    if (round === 0 && p.ovr >= 85 && offers.length === 1 && rng.chance(0.35)) {
      // Wait for more offers next round
      continue;
    }

    // Sign
    p.team = winner.teamId;
    p.contract = {
      years: winner.years,
      aav: Math.round(winner.aav * 10) / 10,
      signedYear: league.year,
      signingBonus: Math.round(winner.aav * 0.4 * 10) / 10,
    };
    league.freeAgents = league.freeAgents.filter((x) => x.playerId !== p.id);
    signedThisRound++;

    league.news.unshift({
      id: `fa${p.id}-${league.year}-${round}`,
      year: league.year, week: 0, ts: Date.now(),
      category: "FA",
      headline: `${TEAMS_BY_ID[winner.teamId].name} sign ${p.firstName} ${p.lastName} (${p.position}, ${p.ovr} OVR) — ${winner.years}yr / $${p.contract.aav.toFixed(1)}M AAV`,
      teamId: winner.teamId, playerId: p.id,
    });
  }
  return signedThisRound;
}

export function currentTeamPayroll(league: League, teamId: string): number {
  let total = 0;
  for (const p of Object.values(league.players)) {
    if (p.team === teamId && p.contract) total += p.contract.aav;
  }
  return total;
}

/** Legacy helper for older callers: position-need scoring kept for backward compat. */
export function teamNeed(league: League, teamId: string): Record<string, number> {
  const pri = positionPriority(league, teamId);
  // Re-key into the same shape the old caller used
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pri)) out[k] = v;
  return out;
}
