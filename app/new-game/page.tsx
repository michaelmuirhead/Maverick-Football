"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEAMS } from "@/lib/data/teams";
import { useLeague } from "@/lib/store/league";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2 } from "lucide-react";

export default function NewGamePage() {
  const router = useRouter();
  const newLeague = useLeague((s) => s.newLeague);
  const existing = useLeague((s) => s.league);
  const reset = useLeague((s) => s.resetLeague);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const start = async () => {
    if (!picked) return;
    if (existing && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setLoading(true);
    if (existing) await reset();
    await newLeague({ userTeam: picked });
    router.push("/");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">New League</h1>
        <p className="text-sm text-muted">Pick the franchise you want to control. The rest of the league will simulate around you.</p>
      </div>

      {existing && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          You already have a league save. Starting a new league will overwrite it.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {TEAMS.map((t) => (
          <button
            key={t.id}
            onClick={() => setPicked(t.id)}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-surface p-3 text-left tap hover:bg-surface2",
              picked === t.id ? "border-accent ring-2 ring-accent/40" : "border-border",
            )}
          >
            <TeamLogo team={t} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{t.name}</div>
              <div className="truncate text-[11px] text-muted">{t.city} • {t.conference} {t.division}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="sticky bottom-20 z-20 flex justify-end sm:bottom-4">
        <button
          disabled={!picked || loading}
          onClick={start}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-bg shadow-lg tap hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
          {confirmReplace ? "Confirm — replace existing save" : "Start league"}
        </button>
      </div>
    </div>
  );
}
