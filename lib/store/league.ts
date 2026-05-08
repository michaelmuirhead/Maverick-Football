"use client";
import { create } from "zustand";
import type {
  Game, GamePlan, League, OffenseEmphasis, DefenseEmphasis, TempoChoice,
  Player, TradeAsset, TradeOffer, GameResult, UserMode,
} from "@/lib/types";
import { TEAMS } from "@/lib/data/teams";
import { RNG } from "@/lib/rng";
import { generateLeagueRosters, assignDepthChart, getRoster } from "@/lib/gen/roster";
import { buildSchedule, setGameIdSeed, currentGameIdSeed } from "@/lib/gen/schedule";
import { setPlayerIdSeed, currentPlayerIdSeed } from "@/lib/gen/player";
import { emptyStandings, simulateWeek, applyResult, addGameStatsToPlayers, rollInjuries } from "@/lib/sim/season";
import { advancePlayoffsAfterWeek, buildPlayoffBracket } from "@/lib/sim/playoffs";
import { runFullOffseason, generateDraftClass, buildDraftOrder } from "@/lib/offseason";
import {
  saveLeague, loadLeague, deleteLeague, listSaveMetas, createNewSlot, switchToSlot,
  deleteSlot, renameSlot, exportSlot, importSlot, getActiveSlotId,
} from "./db";
import { runMidSeasonTrades, runOffseasonTrades, runTradeBatch, processUserProposal } from "@/lib/cpu/tradeAI";
import { executeTrade, newTradeId } from "@/lib/cpu/tradeExecute";
import {
  initializeCoachingStaffs, runCoachCarousel, setCoachIdSeed, currentCoachIdSeed,
} from "@/lib/cpu/coaches";
import { setGamePlan as setGamePlanRaw, planKey } from "@/lib/cpu/gamePlan";
import { emptyRecordsBook } from "@/lib/cpu/records";
import { ensureAllFranchises, inductFranchiseHoF, retireJerseyNumbers } from "@/lib/cpu/franchise";
import { rollHoldouts, restructureContract, extendContract, cutPlayer } from "@/lib/cpu/contracts";
import { rollInjuryRetirements } from "@/lib/cpu/injuries";
import {
  attachCombineNumbers, STARTING_SCOUTING_POINTS, userScoutProspect,
} from "@/lib/cpu/scouting";
import { maybeGenerateSons } from "@/lib/cpu/lineage";
import { rollUpSeasonRecords } from "@/lib/cpu/records";
import { autoStashLowEndPlayers, moveToPracticeSquad, elevateFromPracticeSquad } from "@/lib/cpu/practiceSquad";
import {
  buildInitialCareer, evaluateUserSeason, generateJobOffers,
  acceptJobOffer as acceptJobOfferRaw, takeYearOff as takeYearOffRaw, retireFromCareer as retireFromCareerRaw,
} from "@/lib/cpu/career";
import type { SaveMeta } from "@/lib/types";

interface LeagueStore {
  league: League | null;
  hydrated: boolean;
  busy: boolean;
  hydrate: () => Promise<void>;
  newLeague: (opts: { userTeam: string; userMode?: UserMode; seed?: string; startYear?: number }) => Promise<void>;
  resetLeague: () => Promise<void>;
  saveNow: () => Promise<void>;
  setUserTeam: (id: string) => void;
  // game flow
  simWeek: () => Promise<void>;
  simToNextUserGame: () => Promise<void>;
  simToOffseason: () => Promise<void>;
  simWholeSeason: () => Promise<void>;
  advanceOffseason: () => Promise<void>;
  // roster mgmt
  setStarter: (teamId: string, position: string, playerId: string) => void;
  // free agency / draft user actions
  signFA: (teamId: string, playerId: string, years: number, aav: number) => void;
  draftPlayerForUser: (playerId: string) => void;
  // live game
  finalizeLiveGame: (gameId: string, result: GameResult) => Promise<void>;
  // trades
  acceptOffer: (offerId: string) => { ok: boolean; reason?: string };
  rejectOffer: (offerId: string) => void;
  proposeTradeToTeam: (toTeamId: string, fromAssets: TradeAsset[], toAssets: TradeAssetSetItem[]) => { accepted: boolean; reason: string; fairness: number };
  generateUserOffers: (count?: number) => Promise<void>;
  // game plans & coaching
  setGamePlanForGame: (gameId: string, plan: { offEmphasis: OffenseEmphasis; defEmphasis: DefenseEmphasis; tempo: TempoChoice; featuredPlayer?: string; shadowPlayer?: string }) => void;
  // contracts
  cutPlayer: (playerId: string, postJune1?: boolean) => { ok: boolean; reason?: string };
  restructure: (playerId: string) => { ok: boolean; reason?: string; capRelief: number };
  extend: (playerId: string, addYears: number, newAav: number) => { ok: boolean; reason?: string };
  // injuries / IR / practice squad
  toIR: (playerId: string) => { ok: boolean; reason?: string };
  fromIR: (playerId: string) => { ok: boolean; reason?: string };
  toPracticeSquad: (playerId: string) => { ok: boolean; reason?: string };
  fromPracticeSquad: (playerId: string) => { ok: boolean; reason?: string };
  // scouting
  scoutProspect: (prospectId: string) => { ok: boolean; reason?: string; revealed?: { pot: number } };
  // save management
  saveSlots: SaveMeta[];
  refreshSaveSlots: () => Promise<void>;
  createNewSave: (name: string) => Promise<void>;
  switchSave: (id: string) => Promise<void>;
  deleteSave: (id: string) => Promise<void>;
  renameSave: (id: string, name: string) => Promise<void>;
  exportSave: (id: string) => Promise<string | null>;
  importSave: (json: string) => Promise<{ ok: boolean; reason?: string; id?: string }>;
  activeSlotId: string;
  // career
  acceptJobOffer: (offerId: string) => { ok: boolean; reason?: string };
  takeYearOff: () => { ok: boolean; reason?: string };
  retireFromCareer: () => { ok: boolean; reason?: string };
}

type TradeAssetSetItem = TradeAsset;

export const useLeague = create<LeagueStore>((set, get) => ({
  league: null,
  hydrated: false,
  busy: false,

  hydrate: async () => {
    const lg = await loadLeague();
    if (lg) {
      // Backwards-compat: ensure newly-added fields exist on older saves
      if (!lg.pendingOffers) lg.pendingOffers = [];
      if (!lg.tradeLog) lg.tradeLog = [];
      if (!lg.coaches) lg.coaches = {};
      if (!lg.staffs) lg.staffs = {};
      if (!lg.coachFreeAgents) lg.coachFreeAgents = [];
      if (!lg.gamePlans) lg.gamePlans = {};
      if (!lg.records) lg.records = emptyRecordsBook();
      if (!lg.franchises) lg.franchises = {};
      if (!lg.deadCap) lg.deadCap = {};
      if (!lg.practiceSquad) lg.practiceSquad = {};
      if (!lg.scoutingPoints) lg.scoutingPoints = {};
      if (!lg.scoutedProspects) lg.scoutedProspects = [];
      if (!lg.mentorships) lg.mentorships = [];
      // Backwards-compat: pre-mode saves default to Owner
      if (!lg.userMode) lg.userMode = "Owner";
      if (!lg.userCareer && lg.userTeam) {
        lg.userCareer = buildInitialCareer(lg.userMode, lg.userTeam, lg.year);
      }
      if (!lg.jobOffers) lg.jobOffers = [];
      ensureAllFranchises(lg);
      // If a save predates the coaching system, generate staffs now
      if (Object.keys(lg.staffs).length === 0) {
        initializeCoachingStaffs(lg, new RNG(`coachboot:${lg.seed}:${lg.year}`));
      }
      // Reset user team scouting points if missing
      if (lg.userTeam && !lg.scoutingPoints[lg.userTeam]) {
        lg.scoutingPoints[lg.userTeam] = STARTING_SCOUTING_POINTS;
      }

      // restore id seeds
      let maxP = 0;
      for (const id of Object.keys(lg.players)) {
        const n = parseInt(id.replace(/^p/, "")) || 0;
        if (n > maxP) maxP = n;
      }
      setPlayerIdSeed(maxP + 1);
      let maxG = 0;
      for (const g of lg.schedule) {
        const n = parseInt(g.id.replace(/^g/, "")) || 0;
        if (n > maxG) maxG = n;
      }
      setGameIdSeed(maxG + 1);
      let maxC = 0;
      for (const id of Object.keys(lg.coaches)) {
        const n = parseInt(id.replace(/^c/, "")) || 0;
        if (n > maxC) maxC = n;
      }
      setCoachIdSeed(maxC + 1);
    }
    const slotId = await getActiveSlotId();
    set({ league: lg, hydrated: true, activeSlotId: slotId });
    void get().refreshSaveSlots();
  },

  newLeague: async ({ userTeam, userMode = "Owner", seed, startYear }) => {
    set({ busy: true });
    const sd = seed ?? `${Date.now()}`;
    const year = startYear ?? 2026;
    setPlayerIdSeed(1);
    setGameIdSeed(1);
    setCoachIdSeed(1);
    const rng = new RNG(sd);
    const players = generateLeagueRosters(year, rng);
    // assign depth charts per team
    for (const t of TEAMS) {
      const roster = Object.values(players).filter((p) => p.team === t.id);
      assignDepthChart(roster);
    }
    const schedule = buildSchedule(year, new RNG(`sch:${sd}:${year}`));
    const draftPicks = buildDraftOrderInitial(year + 1);
    const draftClass = generateDraftClass(year + 1, new RNG(`class:${year + 1}`));

    const league: League = {
      seed: sd,
      year,
      phase: "RegularSeason",
      week: 1,
      userTeam,
      teams: TEAMS,
      players,
      schedule,
      standings: emptyStandings(),
      awards: [],
      news: [{
        id: `init`, year, week: 0, ts: Date.now(), category: "League",
        headline: `Welcome to Maverick Football — ${year} season is here!`,
      }],
      draftPicks,
      draftClass,
      freeAgents: [],
      pendingOffers: [],
      tradeLog: [],
      coaches: {},
      staffs: {},
      coachFreeAgents: [],
      gamePlans: {},
      records: emptyRecordsBook(),
      franchises: {},
      deadCap: {},
      practiceSquad: {},
      scoutingPoints: { [userTeam]: STARTING_SCOUTING_POINTS },
      scoutedProspects: [],
      mentorships: [],
      userMode,
      userCareer: buildInitialCareer(userMode, userTeam, year),
      jobOffers: [],
      champions: [],
      hall: [],
      founded: year,
      history: [],
    };
    ensureAllFranchises(league);
    initializeCoachingStaffs(league, new RNG(`coach:${sd}:${year}`));
    // Attach combine numbers to the upcoming draft class
    attachCombineNumbers(league.draftClass, new RNG(`combine:${sd}:${year + 1}`));
    set({ league, busy: false });
    await saveLeague(league);
    void get().refreshSaveSlots();
  },

  resetLeague: async () => {
    await deleteLeague();
    set({ league: null });
  },

  saveNow: async () => {
    const lg = get().league;
    if (lg) await saveLeague(lg);
  },

  setUserTeam: (id) => {
    const lg = get().league;
    if (!lg) return;
    set({ league: { ...lg, userTeam: id } });
    void get().saveNow();
  },

  simWeek: async () => {
    const lg = get().league;
    if (!lg) return;
    set({ busy: true });
    if (lg.phase === "RegularSeason") {
      simulateWeek(lg);
      // Mid-season trade activity ramps up toward the deadline (week 9)
      runMidSeasonTrades(lg);
      lg.week += 1;
      if (lg.week > 18) {
        lg.phase = "Playoffs";
        lg.week = 19;
        buildPlayoffBracket(lg);
      }
    } else if (lg.phase === "Playoffs") {
      simulateWeek(lg);
      const justFinished = lg.week;
      advancePlayoffsAfterWeek(lg, justFinished);
      lg.week += 1;
      if (lg.week > 22) {
        lg.phase = "Offseason:Awards";
        lg.week = 0;
      }
    }
    set({ league: { ...lg }, busy: false });
    await get().saveNow();
  },

  simToNextUserGame: async () => {
    const lg = get().league;
    if (!lg) return;
    while (true) {
      const userOnSchedule = lg.schedule.find(
        (g) => g.year === lg.year && g.week === lg.week && !g.played &&
              (g.home === lg.userTeam || g.away === lg.userTeam)
      );
      if (userOnSchedule) break;
      if (lg.phase === "Offseason:Awards" || lg.phase === "Offseason:Done") break;
      await get().simWeek();
      const cur = get().league;
      if (!cur) break;
      if (cur.phase.startsWith("Offseason")) break;
    }
  },

  simToOffseason: async () => {
    const lg = get().league;
    if (!lg) return;
    set({ busy: true });
    while (lg.phase === "RegularSeason" || lg.phase === "Playoffs") {
      await get().simWeek();
      const cur = get().league;
      if (!cur || cur.phase.startsWith("Offseason")) break;
    }
    set({ busy: false });
  },

  simWholeSeason: async () => {
    const lg = get().league;
    if (!lg) return;
    await get().simToOffseason();
  },

  advanceOffseason: async () => {
    const lg = get().league;
    if (!lg) return;
    set({ busy: true });
    // 0a) Evaluate user's season (HC/GM only) — hot seat / firing
    evaluateUserSeason(lg);
    // 0b) Roll up season + career records BEFORE anyone retires
    rollUpSeasonRecords(lg);
    // 1) Coach carousel — fires/hires + COY award using last season's records
    runCoachCarousel(lg);
    // 2) Holdouts go up before FA so demanding players can be re-signed
    rollHoldouts(lg);
    // 3) Trade activity (rosters reshuffle before FA opens)
    runOffseasonTrades(lg);
    // 4) Players with season-ending injuries may retire
    rollInjuryRetirements(lg);
    // 5) Awards, retirements, progression, FA, draft, schedule
    runFullOffseason(lg);
    // 6) Franchise HoF inductions + retired numbers
    inductFranchiseHoF(lg);
    retireJerseyNumbers(lg);
    // 7) Practice-squad auto-stash for low-end players
    autoStashLowEndPlayers(lg);
    // 8) Attach combine numbers to fresh draft class + maybe generate 2nd-gen sons
    attachCombineNumbers(lg.draftClass, new RNG(`combine:${lg.seed}:${lg.year + 1}`));
    if (lg.year - lg.founded >= 22) {
      maybeGenerateSons(lg, lg.year + 1, lg.draftClass, new RNG(`sons:${lg.seed}:${lg.year + 1}`));
    }
    // 9) Reset scouting points for the new offseason
    if (lg.userTeam) {
      lg.scoutingPoints[lg.userTeam] = STARTING_SCOUTING_POINTS;
      lg.scoutedProspects = [];
    }
    // Clear stale pending offers from last year (anything not acted on)
    lg.pendingOffers = lg.pendingOffers.filter((o) => o.status === "pending" && o.year === lg.year);
    // New season → wipe last year's game plans
    lg.gamePlans = {};
    // 10) If user is Fired or sitting out, generate job offers
    if (lg.userCareer && (lg.userCareer.status === "Fired" || lg.userCareer.status === "TakingYearOff")) {
      generateJobOffers(lg);
      // While unemployed, the user has no userTeam to manage
      if (lg.userCareer.status === "Fired" || lg.userCareer.status === "TakingYearOff") {
        lg.userTeam = null;
      }
    }
    set({ league: { ...lg }, busy: false });
    await get().saveNow();
  },

  setStarter: (teamId, position, playerId) => {
    const lg = get().league;
    if (!lg) return;
    const roster = getRoster(lg, teamId).filter((p) => p.position === position);
    for (const p of roster) {
      lg.players[p.id].depth = p.id === playerId ? "Starter" : (lg.players[p.id].depth === "Starter" ? "Backup" : lg.players[p.id].depth);
    }
    // Re-rank backup/reserve below starter
    const sorted = roster
      .filter((p) => p.id !== playerId)
      .sort((a, b) => b.ovr - a.ovr);
    for (let i = 0; i < sorted.length; i++) {
      lg.players[sorted[i].id].depth = i === 0 ? "Backup" : i === 1 ? "Backup" : "Reserve";
    }
    set({ league: { ...lg } });
    void get().saveNow();
  },

  signFA: (teamId, playerId, years, aav) => {
    const lg = get().league;
    if (!lg) return;
    const player = lg.players[playerId];
    if (!player || player.team) return;
    player.team = teamId;
    player.contract = { years, aav, signedYear: lg.year, signingBonus: aav * 0.4 };
    lg.freeAgents = lg.freeAgents.filter((f) => f.playerId !== playerId);
    // reassign depth chart
    const roster = Object.values(lg.players).filter((p) => p.team === teamId);
    assignDepthChart(roster);
    lg.news.unshift({
      id: `usignfa-${player.id}-${lg.year}`,
      year: lg.year, week: 0, ts: Date.now(),
      category: "FA",
      headline: `Signed ${player.firstName} ${player.lastName} (${player.position}, ${player.ovr} OVR) — ${years}yr / $${aav.toFixed(1)}M AAV`,
      teamId, playerId,
    });
    set({ league: { ...lg } });
    void get().saveNow();
  },

  acceptOffer: (offerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const offer = lg.pendingOffers.find((o) => o.id === offerId);
    if (!offer || offer.status !== "pending") return { ok: false, reason: "Offer not found" };
    // The user is on the receiving side. Run as a CPU→User flow that we approve.
    const result = processUserProposal(lg, offer);
    if (!result.accepted) {
      offer.status = "rejected";
      return { ok: false, reason: result.reason };
    }
    offer.status = "accepted";
    set({ league: { ...lg } });
    void get().saveNow();
    return { ok: true };
  },

  rejectOffer: (offerId) => {
    const lg = get().league;
    if (!lg) return;
    const offer = lg.pendingOffers.find((o) => o.id === offerId);
    if (!offer) return;
    offer.status = "rejected";
    set({ league: { ...lg } });
    void get().saveNow();
  },

  proposeTradeToTeam: (toTeamId, fromAssets, toAssets) => {
    const lg = get().league;
    if (!lg || !lg.userTeam) return { accepted: false, reason: "No user team", fairness: 0 };
    if (toTeamId === lg.userTeam) return { accepted: false, reason: "Can't trade with yourself", fairness: 0 };
    if (fromAssets.length === 0 && toAssets.length === 0) return { accepted: false, reason: "Empty offer", fairness: 0 };

    const offer: TradeOffer = {
      id: newTradeId(),
      fromTeam: lg.userTeam,
      toTeam: toTeamId,
      fromAssets,
      toAssets,
      status: "pending",
      year: lg.year,
      week: lg.phase === "RegularSeason" ? lg.week : 0,
      ts: Date.now(),
      byUser: true,
    };
    const result = processUserProposal(lg, offer);
    if (result.accepted) {
      set({ league: { ...lg } });
      void get().saveNow();
    }
    return result;
  },

  generateUserOffers: async (count = 2) => {
    const lg = get().league;
    if (!lg || !lg.userTeam) return;
    runTradeBatch(lg, { maxAttempts: count * 6, userOnly: true });
    set({ league: { ...lg } });
    await get().saveNow();
  },

  setGamePlanForGame: (gameId, plan) => {
    const lg = get().league;
    if (!lg || !lg.userTeam) return;
    const gp: GamePlan = {
      gameId, teamId: lg.userTeam,
      offEmphasis: plan.offEmphasis,
      defEmphasis: plan.defEmphasis,
      tempo: plan.tempo,
      featuredPlayer: plan.featuredPlayer,
      shadowPlayer: plan.shadowPlayer,
      byUser: true,
    };
    setGamePlanRaw(lg, gp);
    set({ league: { ...lg } });
    void get().saveNow();
  },

  cutPlayer: (playerId, postJune1) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const result = cutPlayer(lg, playerId, { postJune1 });
    if (result.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return { ok: result.ok, reason: result.reason };
  },
  restructure: (playerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league", capRelief: 0 };
    const r = restructureContract(lg, playerId);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return { ok: r.ok, reason: r.reason, capRelief: r.capRelief };
  },
  extend: (playerId, addYears, newAav) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = extendContract(lg, playerId, { addYears, newAav });
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return r;
  },
  toIR: (playerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const p = lg.players[playerId];
    if (!p) return { ok: false, reason: "Player not found" };
    if (!p.injury) return { ok: false, reason: "Player not injured" };
    if (p.injury.severity === "Minor") return { ok: false, reason: "Injury too minor for IR" };
    p.onIR = true;
    set({ league: { ...lg } });
    void get().saveNow();
    return { ok: true };
  },
  fromIR: (playerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const p = lg.players[playerId];
    if (!p) return { ok: false, reason: "Player not found" };
    if (p.injury && p.injury.severity !== "Minor") return { ok: false, reason: "Still injured" };
    p.onIR = false;
    set({ league: { ...lg } });
    void get().saveNow();
    return { ok: true };
  },
  toPracticeSquad: (playerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = moveToPracticeSquad(lg, playerId);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return r;
  },
  fromPracticeSquad: (playerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = elevateFromPracticeSquad(lg, playerId);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return r;
  },
  scoutProspect: (prospectId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = userScoutProspect(lg, prospectId);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return { ok: r.ok, reason: r.reason, revealed: r.revealed };
  },

  // Save management
  saveSlots: [],
  activeSlotId: "main",
  refreshSaveSlots: async () => {
    const slots = await listSaveMetas();
    const id = await getActiveSlotId();
    set({ saveSlots: slots, activeSlotId: id });
  },
  createNewSave: async (name) => {
    await createNewSlot(name);
    set({ league: null });
    await get().refreshSaveSlots();
  },
  switchSave: async (id) => {
    await switchToSlot(id);
    await get().hydrate();
    await get().refreshSaveSlots();
  },
  deleteSave: async (id) => {
    await deleteSlot(id);
    const cur = await getActiveSlotId();
    if (cur === id) {
      set({ league: null });
    }
    await get().refreshSaveSlots();
  },
  renameSave: async (id, name) => {
    await renameSlot(id, name);
    await get().refreshSaveSlots();
  },
  exportSave: async (id) => {
    return await exportSlot(id);
  },
  importSave: async (json) => {
    const r = await importSlot(json);
    if (r.ok) await get().refreshSaveSlots();
    return r;
  },

  acceptJobOffer: (offerId) => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = acceptJobOfferRaw(lg, offerId);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return r;
  },
  takeYearOff: () => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = takeYearOffRaw(lg);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return r;
  },
  retireFromCareer: () => {
    const lg = get().league;
    if (!lg) return { ok: false, reason: "No league" };
    const r = retireFromCareerRaw(lg);
    if (r.ok) { set({ league: { ...lg } }); void get().saveNow(); }
    return r;
  },

  finalizeLiveGame: async (gameId, result) => {
    const lg = get().league;
    if (!lg) return;
    const game = lg.schedule.find((g) => g.id === gameId);
    if (!game || game.played) return;
    game.result = result;
    game.played = true;
    applyResult(lg, game, result);
    addGameStatsToPlayers(lg, game, result);
    rollInjuries(lg, game);
    lg.news.unshift({
      id: `n${Date.now()}-${game.id}`,
      year: lg.year,
      week: game.week,
      ts: Date.now(),
      category: "Game",
      headline: result.storyline,
      teamId: result.homeScore > result.awayScore ? game.home : game.away,
    });
    // Decrement injuries for all players (mirrors simulateWeek effect for that game)
    // — skip; that happens at week boundary. A live single-game shouldn't tick week injuries.
    set({ league: { ...lg } });
    await get().saveNow();
  },

  draftPlayerForUser: (playerId) => {
    const lg = get().league;
    if (!lg) return;
    const userPick = lg.draftPicks
      .filter((dp) => dp.year === lg.year && dp.currentTeam === lg.userTeam && !dp.used)
      .sort((a, b) => a.round - b.round || a.pick - b.pick)[0];
    if (!userPick) return;
    const prospect = lg.draftClass.find((p) => p.id === playerId);
    if (!prospect) return;
    prospect.team = lg.userTeam!;
    prospect.draftRound = userPick.round;
    prospect.draftPick = userPick.pick;
    prospect.contract = {
      years: userPick.round === 1 ? 4 : 3,
      aav: 4 - (userPick.round - 1) * 0.5,
      signedYear: lg.year,
      signingBonus: 1,
    };
    userPick.used = true;
    userPick.playerId = prospect.id;
    lg.players[prospect.id] = prospect as unknown as Player;
    const roster = Object.values(lg.players).filter((p) => p.team === lg.userTeam);
    assignDepthChart(roster);
    lg.news.unshift({
      id: `udraft-${prospect.id}`,
      year: lg.year, week: 0, ts: Date.now(),
      category: "Draft",
      headline: `Drafted ${prospect.firstName} ${prospect.lastName} (${prospect.position}, ${prospect.college})`,
      teamId: lg.userTeam!, playerId: prospect.id,
    });
    set({ league: { ...lg } });
    void get().saveNow();
  },
}));

function buildDraftOrderInitial(year: number) {
  // For brand-new league, draft order is just team list shuffled
  const picks = [];
  for (let r = 1; r <= 7; r++) {
    let p = 1;
    for (const t of TEAMS) {
      picks.push({ year, round: r, pick: p, originalTeam: t.id, currentTeam: t.id });
      p++;
    }
  }
  return picks;
}
