"use client";
import { useLeague } from "@/lib/store/league";
import { cn } from "@/lib/utils";
import { ChevronRight, FastForward, SkipForward, Loader2 } from "lucide-react";

export function SimWeekButton({ className }: { className?: string }) {
  const league = useLeague((s) => s.league);
  const busy = useLeague((s) => s.busy);
  const simWeek = useLeague((s) => s.simWeek);
  const advance = useLeague((s) => s.advanceOffseason);
  if (!league) return null;
  const isOffseason = league.phase.startsWith("Offseason");
  return (
    <button
      onClick={() => isOffseason ? advance() : simWeek()}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-bg shadow-sm tap hover:opacity-90 disabled:opacity-40",
        className,
      )}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
      {isOffseason ? "Run Offseason" : "Sim Week"}
    </button>
  );
}

export function SimSeasonButton({ className }: { className?: string }) {
  const league = useLeague((s) => s.league);
  const busy = useLeague((s) => s.busy);
  const simWholeSeason = useLeague((s) => s.simWholeSeason);
  if (!league) return null;
  if (league.phase.startsWith("Offseason")) return null;
  return (
    <button
      onClick={() => simWholeSeason()}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs font-medium tap hover:bg-surface disabled:opacity-40",
        className,
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FastForward size={14} />}
      Sim to Offseason
    </button>
  );
}

export function SimToUserGameButton({ className }: { className?: string }) {
  const league = useLeague((s) => s.league);
  const busy = useLeague((s) => s.busy);
  const fn = useLeague((s) => s.simToNextUserGame);
  if (!league || !league.userTeam) return null;
  return (
    <button
      onClick={() => fn()}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs font-medium tap hover:bg-surface disabled:opacity-40",
        className,
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />}
      Sim to my next game
    </button>
  );
}
