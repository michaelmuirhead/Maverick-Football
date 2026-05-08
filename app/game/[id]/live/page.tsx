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
import { Pause, Play, FastForward, SkipForward, ChevronRight, Loader2, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { OFFENSE_EMPHASIS_OPTIONS, DEFENSE_EMPHASIS_OPTIONS, TEMPO_OPTIONS, getGamePlan } from "@/lib/cpu/gamePlan";
import type { OffenseEmphasis, DefenseEmphasis, TempoChoice } from "@/lib/types";
import { userCan } from "@/lib/cpu/career";

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
  const setGamePlan = useLeague((s) => s.setGamePlanForGame);

  // Generator + event log
  const genRef = useRef<Generator<LiveEvent, GameResult, void> | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [done, setDone] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<keyof typeof SPEED_MS>("1x");
  const [skipping, setSkipping] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
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
          {league && userCan(league, "gamePlans") && (game.home === league.userTeam || game.away === league.userTeam) && (
            <button
              onClick={() => { setPlaying(false); setShowAdjust((v) => !v); }}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium tap",
                showAdjust ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface hover:bg-surface2",
              )}
            >
              <Sliders size={14} /> Adjust
            </button>
          )}
        </div>
      )}

      {showAdjust && league && (
        <HalftimeAdjustPanel
          league={league}
          gameId={game.id}
          onSave={(plan) => {
            setGamePlan(game.id, plan);
            setShowAdjust(false);
            setPlaying(true);
          }}
          onCancel={() => setShowAdjust(false)}
        />
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

function HalftimeAdjustPanel({
  league, gameId, onSave, onCancel,
}: {
  league: import("@/lib/types").League;
  gameId: string;
  onSave: (plan: { offEmphasis: OffenseEmphasis; defEmphasis: DefenseEmphasis; tempo: TempoChoice }) => void;
  onCancel: () => void;
}) {
  const userTeam = league.userTeam!;
  const existing = getGamePlan(league, gameId, userTeam);
  const [off, setOff] = useState<OffenseEmphasis>(existing?.offEmphasis ?? "Balanced");
  const [def, setDef] = useState<DefenseEmphasis>(existing?.defEmphasis ?? "Balanced");
  const [tempo, setTempo] = useState<TempoChoice>(existing?.tempo ?? "Balanced");

  return (
    <div className="rounded-lg border border-accent/30 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-accent">Halftime adjustments</h3>
        <span className="text-[10px] text-muted">Takes effect immediately</span>
      </div>
      <div className="space-y-3">
        <Group label="Offense">
          {OFFENSE_EMPHASIS_OPTIONS.map((o) => (
            <PillBtn key={o.id} active={off === o.id} onClick={() => setOff(o.id)}>{o.label}</PillBtn>
          ))}
        </Group>
        <Group label="Defense">
          {DEFENSE_EMPHASIS_OPTIONS.map((o) => (
            <PillBtn key={o.id} active={def === o.id} onClick={() => setDef(o.id)}>{o.label}</PillBtn>
          ))}
        </Group>
        <Group label="Tempo">
          {TEMPO_OPTIONS.map((o) => (
            <PillBtn key={o.id} active={tempo === o.id} onClick={() => setTempo(o.id)}>{o.label}</PillBtn>
          ))}
        </Group>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onSave({ offEmphasis: off, defEmphasis: def, tempo })}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90"
        >
          Save & resume
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}
function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs tap",
        active ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface hover:bg-surface2 text-muted",
      )}
    >
      {children}
    </button>
  );
}
