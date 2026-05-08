"use client";
import Link from "next/link";
import type { Conference, Game, League, StandingsRow } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "./team-logo";
import { computePlayoffSeeds } from "@/lib/sim/season";
import { cn } from "@/lib/utils";

// =====================================================================
// Visual playoff bracket. AFC on the left, NFC on the right, SB in the
// middle. Each round flows toward the center.
// =====================================================================

interface BracketSlot {
  game?: Game;
  // for placeholder slots (1-seed bye, future rounds)
  homeId?: string | null;
  awayId?: string | null;
  homeSeed?: number;
  awaySeed?: number;
  label?: string;
}

export function PlayoffBracket({ league }: { league: League }) {
  const afc = computePlayoffSeeds(league, "AFC");
  const nfc = computePlayoffSeeds(league, "NFC");

  const afcSlots = buildConfSlots(league, "AFC", afc);
  const nfcSlots = buildConfSlots(league, "NFC", nfc);

  const sbGame = league.schedule.find((g) => g.year === league.year && g.week === 22);

  return (
    <div className="space-y-3">
      {/* Round headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted">
        <div>Wild Card</div>
        <div>Divisional</div>
        <div>Conf Champ</div>
        <div>Super Bowl</div>
        <div>Conf Champ</div>
        <div>Divisional</div>
        <div>Wild Card</div>
      </div>

      {/* Bracket grid */}
      <div className="grid grid-cols-7 items-center gap-1">
        {/* AFC side, left to right */}
        <Column slots={afcSlots.wildCard} variant="afc" />
        <Column slots={afcSlots.divisional} variant="afc" tall />
        <Column slots={afcSlots.conf} variant="afc" />

        {/* Super Bowl (middle) */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">★ Super Bowl ★</div>
          <SlotCard slot={sbGame ? { game: sbGame } : { label: "TBD" }} variant="sb" />
        </div>

        {/* NFC side, right to left visually (we mirror) */}
        <Column slots={nfcSlots.conf} variant="nfc" align="right" />
        <Column slots={nfcSlots.divisional} variant="nfc" tall align="right" />
        <Column slots={nfcSlots.wildCard} variant="nfc" align="right" />
      </div>
    </div>
  );
}

function buildConfSlots(league: League, conf: Conference, seeds: StandingsRow[]) {
  const wcGames = league.schedule.filter(
    (g) => g.year === league.year && g.week === 19 && g.conference === conf,
  );
  const divGames = league.schedule.filter(
    (g) => g.year === league.year && g.week === 20 && g.conference === conf,
  );
  const confGames = league.schedule.filter(
    (g) => g.year === league.year && g.week === 21 && g.conference === conf,
  );

  // Wild Card slots — always 3 + a bye row for the 1 seed
  const wildCard: BracketSlot[] = [];
  const oneSeed = seeds[0];
  wildCard.push({
    label: "1 seed bye",
    homeId: oneSeed?.team, homeSeed: 1,
    awayId: null,
  });
  // Sort WC games by seed of away team for display order
  const wc = [...wcGames].sort((a, b) => seedOf(seeds, a.away) - seedOf(seeds, b.away));
  for (const g of wc) wildCard.push({ game: g });

  // Divisional: 2 slots
  const divisional: BracketSlot[] = [];
  for (const g of divGames) divisional.push({ game: g });
  while (divisional.length < 2) divisional.push({ label: "TBD" });

  // Conference championship: 1 slot
  const conf2: BracketSlot[] = [];
  for (const g of confGames) conf2.push({ game: g });
  if (conf2.length === 0) conf2.push({ label: "TBD" });

  return { wildCard, divisional, conf: conf2 };
}

function seedOf(seeds: StandingsRow[], teamId: string): number {
  return seeds.find((s) => s.team === teamId)?.seed ?? 99;
}

function Column({ slots, variant, tall, align }: { slots: BracketSlot[]; variant: "afc" | "nfc"; tall?: boolean; align?: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col gap-2", tall && "gap-6", align === "right" && "items-end")}>
      {slots.map((s, i) => <SlotCard key={i} slot={s} variant={variant} />)}
    </div>
  );
}

function SlotCard({ slot, variant }: { slot: BracketSlot; variant?: "afc" | "nfc" | "sb" }) {
  // Bye placeholder (1-seed advances)
  if (slot.label === "1 seed bye" && slot.homeId) {
    const team = TEAMS_BY_ID[slot.homeId];
    return (
      <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-2 text-xs">
        <div className="text-[10px] uppercase tracking-wider text-amber-300/80">Bye</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded bg-amber-500/15 text-[9px] font-bold text-amber-300">1</span>
          <TeamLogo team={team} size={16} />
          <span className="truncate font-medium">{team.abbr}</span>
        </div>
      </div>
    );
  }
  if (!slot.game) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface/40 px-3 py-3 text-center text-[11px] text-muted">
        TBD
      </div>
    );
  }
  const g = slot.game;
  const home = TEAMS_BY_ID[g.home];
  const away = TEAMS_BY_ID[g.away];
  const r = g.result;
  const homeWon = r ? r.homeScore > r.awayScore : false;
  const awayWon = r ? r.awayScore > r.homeScore : false;
  const isSB = variant === "sb" || g.playoffRound === "SB";
  return (
    <Link
      href={`/game/${g.id}${g.played ? "" : "/preview"}`}
      className={cn(
        "block rounded-md border bg-surface p-2 text-xs transition tap hover:border-accent/40 hover:bg-surface2",
        isSB ? "border-fuchsia-500/40" : "border-border",
      )}
    >
      <BracketRow team={away} score={r?.awayScore} won={awayWon} played={g.played} />
      <BracketRow team={home} score={r?.homeScore} won={homeWon} played={g.played} />
      {!g.played && <div className="mt-1 text-[9px] uppercase tracking-wider text-muted">Wk {g.week}</div>}
      {r?.ot && <div className="mt-1 text-[9px] font-bold text-accent">OT</div>}
    </Link>
  );
}

function BracketRow({ team, score, won, played }: { team: typeof TEAMS_BY_ID[string]; score?: number; won?: boolean; played: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5", played && !won && "opacity-50")}>
      <TeamLogo team={team} size={14} />
      <span className="flex-1 truncate font-medium">{team.abbr}</span>
      {played && score !== undefined && (
        <span className={cn("font-mono tabular-nums", won && "font-bold text-fg")}>{score}</span>
      )}
    </div>
  );
}
