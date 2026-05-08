import { RNG } from "@/lib/rng";
import type {
  Coach, League, PressEventKind, PressItem, Player,
} from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { staffOf } from "./coaches";

// =====================================================================
// Press conference quote generator. Procedurally fills template strings
// with team/player/score context to generate flavor quotes after big
// in-game and offseason events.
// =====================================================================

let pressIdCounter = 1;
function newPressId() { return `prs${Date.now()}-${pressIdCounter++}`; }

interface Ctx {
  league: League;
  teamId: string;
  ts?: number;
  week?: number;
  coach?: Coach;
  player?: Player;
  opponent?: string;
  margin?: number;
  win?: boolean;
  champ?: boolean;
  recordWL?: { w: number; l: number };
  extra?: Record<string, string | number>;
}

const TEMPLATES: Record<PressEventKind, string[]> = {
  PostGameWin: [
    "We did our jobs tonight. Credit to {opp_abbr} — they came to play, but our guys executed.",
    "Big team win. Defense set the tone, offense made the plays when we had to.",
    "I'm proud of how our team responded. We needed this one.",
    "When you've got dudes in that locker room who care about each other, this is what happens.",
    "We talk about it every week — be where your feet are. The guys did that today.",
  ],
  PostGameLoss: [
    "I have to do a better job. We didn't play complementary football.",
    "We've got to clean up the self-inflicted wounds. Penalties, missed assignments — that's on me.",
    "Disappointed. We had our chances and didn't make the plays. We'll watch the tape and be back at it Monday.",
    "{opp_abbr} earned that one. Doesn't take anything away from how hard we have to look in the mirror.",
    "We're a one-game-at-a-time team. This stings — and it should. Tomorrow we get back to work.",
  ],
  BigTrade: [
    "We had a chance to add a difference-maker and we took it. Front office did a tremendous job.",
    "This was a difficult decision but the right one for the franchise long-term.",
    "{player_name} fits exactly what we're trying to build. Excited to get to work.",
    "Nobody likes parting ways with a guy who's been part of this family. But this league is about competing — and we just got better.",
    "Front office and ownership were aligned. When the right deal presented itself, we acted.",
  ],
  BigSigning: [
    "We targeted {player_name} from day one of free agency. To get this done is huge for us.",
    "When you find a guy who fits the locker room and can play at this level, you make it happen.",
    "{player_name} is the kind of professional we want our young guys learning from every day.",
    "This was a culture-defining signing. Glad to have him.",
  ],
  DraftDay: [
    "Best player available was the easiest call we've had in years.",
    "We had {player_name} ranked higher than the league. Couldn't believe he was still there.",
    "We trust our board. The board fell our way today.",
    "{player_name} fits scheme, fits culture, fits the room. This is who we are now.",
  ],
  Hire: [
    "I'm honored. The {team_name} family is special, and I can't wait to roll up my sleeves.",
    "This organization has the pieces to win. My job is to bring it together.",
    "Everyone in this building is committed to one thing — winning championships. So am I.",
    "I want our fans to know: we're going to play smart, tough, physical football. That's the standard.",
  ],
  Fire: [
    "Decisions like this are never easy. We're grateful for everything {coach_name} did and we wish them the best.",
    "The results weren't where we wanted. The franchise has standards — and we have to meet them.",
    "Sometimes change is necessary. We'll move forward with conviction.",
    "Ownership thanks {coach_name} for their service. We'll begin a national search immediately.",
  ],
  Championship: [
    "DYNASTIES. ARE. BUILT. ON. NIGHTS. LIKE. THIS.",
    "I told these guys all year — believe in each other. They did. And now we're champions.",
    "This is for our fans. They've been through a lot. Tonight is theirs.",
    "I'll never forget this team. Whatever happens from here, we'll always have this.",
    "We climbed the mountain. Tomorrow we start climbing it again.",
  ],
  BadSeason: [
    "We've got to be honest about where we are. {record} isn't good enough — and we own that.",
    "There's a long offseason ahead. Every part of this operation will be evaluated.",
    "I take full responsibility. The talent is in the building. The execution is on us.",
    "We're going to be relentless about getting this right. Our fans deserve better.",
  ],
  RookieDebut: [
    "{player_name} is just scratching the surface. Wait till you see him in year two.",
    "First start in this league — and the moment wasn't too big for him. That's a great sign.",
    "We drafted him for moments like this. He delivered.",
  ],
  MilestoneRecord: [
    "Records are nice but it's about the next play. {player_name} embodies that.",
    "What {player_name} just did is something kids will be talking about for a long time. Proud of him.",
    "When you get to do this for a living and you get to share it with teammates and fans — that's everything.",
  ],
};

function fill(template: string, ctx: Ctx): string {
  const team = TEAMS_BY_ID[ctx.teamId];
  const opp = ctx.opponent ? TEAMS_BY_ID[ctx.opponent] : null;
  const playerName = ctx.player ? `${ctx.player.firstName} ${ctx.player.lastName}` : "the player";
  const coachName = ctx.coach ? `${ctx.coach.firstName} ${ctx.coach.lastName}` : "Coach";
  const recordStr = ctx.recordWL ? `${ctx.recordWL.w}-${ctx.recordWL.l}` : "the record";
  return template
    .replace(/\{team_name\}/g, `${team.city} ${team.name}`)
    .replace(/\{team_abbr\}/g, team.abbr)
    .replace(/\{opp_abbr\}/g, opp?.abbr ?? "the opponent")
    .replace(/\{opp_name\}/g, opp ? `${opp.city} ${opp.name}` : "the opponent")
    .replace(/\{player_name\}/g, playerName)
    .replace(/\{coach_name\}/g, coachName)
    .replace(/\{record\}/g, recordStr);
}

export function emitPress(league: League, kind: PressEventKind, ctx: Ctx): PressItem {
  const rng = new RNG(`press:${kind}:${ctx.teamId}:${league.year}:${league.week}:${ctx.player?.id ?? ""}:${ctx.opponent ?? ""}`);
  const templates = TEMPLATES[kind];
  const quote = fill(rng.pick(templates), ctx);

  // Speaker selection
  let speakerRole: PressItem["speakerRole"] = "HC";
  let speakerName = "Head Coach";
  const staff = staffOf(league, ctx.teamId);
  if (kind === "BigTrade" || kind === "BigSigning" || kind === "DraftDay") {
    speakerRole = "GM";
    speakerName = "General Manager";
  } else if (kind === "Fire" || kind === "Hire") {
    speakerRole = kind === "Hire" ? "HC" : "Owner";
    speakerName = kind === "Hire" ? (staff.hc ? `${staff.hc.firstName} ${staff.hc.lastName}` : "New head coach") : "Team owner";
  } else if (kind === "MilestoneRecord" && ctx.player) {
    speakerRole = "Player";
    speakerName = `${ctx.player.firstName} ${ctx.player.lastName}`;
  } else if (staff.hc) {
    speakerRole = "HC";
    speakerName = `${staff.hc.firstName} ${staff.hc.lastName}`;
  }

  const item: PressItem = {
    id: newPressId(),
    year: league.year,
    week: ctx.week ?? league.week,
    ts: ctx.ts ?? Date.now(),
    kind,
    speaker: speakerName,
    speakerRole,
    team: ctx.teamId,
    quote,
    context: ctx.opponent
      ? `vs ${TEAMS_BY_ID[ctx.opponent]?.abbr}${ctx.margin !== undefined ? ` (margin ${ctx.margin})` : ""}`
      : undefined,
  };

  league.press = league.press ?? [];
  league.press.unshift(item);
  // Cap press feed at 200 items
  if (league.press.length > 200) league.press = league.press.slice(0, 200);
  return item;
}

/**
 * Hook called from sim/season after a game — emit press for blowouts and
 * upset wins; otherwise quiet.
 */
export function pressAfterGame(league: League, gameId: string) {
  const game = league.schedule.find((g) => g.id === gameId);
  if (!game?.result) return;
  const home = TEAMS_BY_ID[game.home];
  const away = TEAMS_BY_ID[game.away];
  const margin = Math.abs(game.result.homeScore - game.result.awayScore);
  const homeWon = game.result.homeScore > game.result.awayScore;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const isBlowout = margin >= 21;
  const isClose = margin <= 3;

  // Always speak after blowouts; sometimes after close games
  if (!isBlowout && !isClose && Math.random() > 0.18) return;

  emitPress(league, "PostGameWin", {
    league, teamId: winner.id, opponent: loser.id, margin, win: true,
    week: game.week,
  });
  // Loser also speaks if it was a blowout
  if (isBlowout) {
    emitPress(league, "PostGameLoss", {
      league, teamId: loser.id, opponent: winner.id, margin, win: false,
      week: game.week,
    });
  }
}
