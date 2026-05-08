"use client";
import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { Empty, Panel, Section } from "@/components/panels";
import { FieldView } from "@/components/field-view";
import { createLiveGame, type LiveEvent } from "@/lib/sim/livePlayByPlay";
import type { GameResult } from "@/lib/types";
import { Pause, Play, FastForward, SkipForward, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SPEED_MS: Record<string, number> = {
  "0.5x": 2400,
  "1x": 1400,
  "2x": 700,
  "4x": 280,
};

export default function LiveGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const league = useLeague((s) => s.league);
  const finalize = useLeague((s) => s.finalizeLiveGame);

  const game = league?.schedule.find((g) => g.id === id);

  // Generator + event log
  const genRef = useRef<Generator<LiveEvent, GameResult, void> | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [done, setDone] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<keyof typeof SPEED_MS>("1x");
  const [skipping, setSkipping] = useState(false);
  const finalizedRef = useRef(false);

  // Init generator once when league + game ready
  useEffect(() => {
    if (!league || !game || game.played || genRef.current) return;
    genRef.current = createLiveGame(league, game, league.seed);
    // Pull the first event so the field has state to render
    const first = genRef.current.next();
    if (!first.done) setEvents([first.value]);
  }, [league, game]);

  // Pump events on a timer
  useEffect(() => {
    if (!playing || done || skipping) return;
    if (!genRef.current) return;
    const interval = setInterval(() => {
      const gen = genRef.current!;
      const nx = gen.next();
      if (nx.done) {
        setDone(nx.value);
        return;
      }
      setEvents((prev) => [...prev, nx.value]);
    }, SPEED_MS[speed]);
    return () => clearInterval(interval);
  }, [playing, speed, done, skipping]);

  // Skip to end — flush generator synchronously
  function skipToEnd() {
    if (!genRef.current) return;
    setSkipping(true);
    const gen = genRef.current;
    const collected: LiveEvent[] = [...events];
    let result: GameResult | null = null;
    // Yield up to 4000 events to be safe
    for (let i = 0; i < 4000; i++) {
      const nx = gen.next();
      if (nx.done) { result = nx.value; break; }
      collected.push(nx.value);
    }
    setEvents(collected);
    if (result) setDone(result);
    setSkipping(false);
  }

  // On game end, save result back to league
  useEffect(() => {
    if (!done || finalizedRef.current || !game) return;
    finalizedRef.current = true;
    void finalize(game.id, done);
  }, [done, finalize, game]);

  // Auto-scroll commentary feed
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!feedRef.current) return;
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events.length]);

  if (!league) return <Empty>No league yet.</Empty>;
  if (!game) return <Empty>Game not found.</Empty>;
  if (game.played) {
    // Already played — bounce to box score
    return (
      <div className="space-y-3">
        <Empty>This game has already been played.</Empty>
        <Link href={`/game/${game.id}`} className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-bold text-bg">
          View box score <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  const home = TEAMS_BY_ID[game.home];
  const away = TEAMS_BY_ID[game.away];
  const last = events[events.length - 1];
  const state = last?.state ?? null;

  return (
    <div className="space-y-4">
      {/* Score banner */}
      <div className="grid grid-cols-3 items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <TeamLogo team={away} size={36} />
          <div className="min-w-0">
            <div className="truncate font-display text-base font-bold leading-tight">{away.name}</div>
            <div className="text-[11px] text-muted">{away.city}</div>
          </div>
          <span className="ml-auto font-mono text-2xl font-bold tabular-nums">{state?.awayScore ?? 0}</span>
        </div>
        <div className="text-center">
          <div className="font-mono text-xs uppercase tracking-wider text-muted">
            {state ? formatPeriod(state.qtr) : "Q1"} • {state ? formatClock(state.secLeft) : "15:00"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-accent">{done ? "FINAL" : "LIVE"}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums">{state?.homeScore ?? 0}</span>
          <div className="ml-auto min-w-0 text-right">
            <div className="truncate font-display text-base font-bold leading-tight">{home.name}</div>
            <div className="text-[11px] text-muted">{home.city}</div>
          </div>
          <TeamLogo team={home} size={36} />
        </div>
      </div>

      {/* Field */}
      {state && (
        <FieldView
          home={home}
          away={away}
          possession={state.possession}
          ballYL={state.ballYL}
          toGo={state.toGo}
          down={state.down}
        />
      )}

      {/* Controls */}
      {!done && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-bold text-bg tap hover:opacity-90"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
            {(Object.keys(SPEED_MS) as (keyof typeof SPEED_MS)[]).map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                className={cn("rounded px-2 py-1 text-xs tap", speed === s ? "bg-accent text-bg" : "text-muted hover:text-fg")}>
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={skipToEnd}
            disabled={skipping}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium tap hover:bg-surface2 disabled:opacity-40"
          >
            {skipping ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />}
            Skip to end
          </button>
        </div>
      )}

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <div className="text-sm">
            <strong>Final:</strong> {done.storyline}
          </div>
          <Link href={`/game/${game.id}`} className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-bold text-bg">
            View box score <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Commentary feed */}
      <Section title="Play-by-play">
        <div ref={feedRef} className="scrollbar-thin h-[420px] overflow-y-auto rounded-lg border border-border bg-surface">
          <ul className="divide-y divide-border/60">
            {events.slice().reverse().map((ev, i) => (
              <li
                key={events.length - i}
                className={cn(
                  "flex items-start gap-3 px-3 py-2 text-sm",
                  ev.bigPlay && "bg-accent/5",
                )}
              >
                <span className="font-mono text-[10px] text-muted shrink-0 mt-0.5 w-14">
                  {formatPeriod(ev.state.qtr)} {formatClock(ev.state.secLeft)}
                </span>
                <span className={cn("flex-1", ev.kind === "td" && "font-bold text-emerald-400", (ev.kind === "turnover" || ev.kind === "sack") && "text-red-300")}>
                  {ev.description}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted shrink-0">
                  {ev.state.awayScore}–{ev.state.homeScore}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}

function formatPeriod(q: number) {
  if (q === 5) return "OT";
  return `Q${q}`;
}
function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
