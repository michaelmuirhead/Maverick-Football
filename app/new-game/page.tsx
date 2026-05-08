"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEAMS } from "@/lib/data/teams";
import { useLeague } from "@/lib/store/league";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Crown, Briefcase, Headphones } from "lucide-react";
import type { UserMode } from "@/lib/types";
import { describeMode } from "@/lib/cpu/career";

const MODES: { id: UserMode; label: string; icon: typeof Crown; tagline: string; controls: string[]; risks: string }[] = [
  {
    id: "Owner",
    label: "Owner",
    icon: Crown,
    tagline: "Full control. Never fired. Steer the franchise across decades.",
    controls: ["Trades, FA, draft, contracts", "Depth chart + game plans", "Hire & fire your staff"],
    risks: "No job risk. The franchise is yours.",
  },
  {
    id: "GM",
    label: "General Manager",
    icon: Briefcase,
    tagline: "Build the roster. Coach handles game day. Hot seat applies.",
    controls: ["Trades, free agency, draft", "Cuts, restructures, extensions", "IR, practice squad, scouting"],
    risks: "Owner expects a contender. Bad cap + bad records → fired.",
  },
  {
    id: "HC",
    label: "Head Coach",
    icon: Headphones,
    tagline: "Run the sideline. GM owns the roster. Win or get replaced.",
    controls: ["Depth chart", "Weekly game plans", "Live play-by-play"],
    risks: "Wins are your scoreboard. Losing seasons → fired.",
  },
];

export default function NewGamePage() {
  const router = useRouter();
  const newLeague = useLeague((s) => s.newLeague);
  const existing = useLeague((s) => s.league);
  const reset = useLeague((s) => s.resetLeague);

  const [mode, setMode] = useState<UserMode>("Owner");
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
    await newLeague({ userTeam: picked, userMode: mode });
    router.push("/");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">New League</h1>
        <p className="text-sm text-muted">Pick your role and the franchise you want to control.</p>
      </div>

      {existing && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          You already have a league save in this slot. Starting a new league will overwrite it.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">1. Choose your role</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "rounded-lg border p-4 text-left tap transition",
                  active
                    ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                    : "border-border bg-surface hover:bg-surface2",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "grid h-9 w-9 place-items-center rounded-md",
                    active ? "bg-accent text-bg" : "bg-surface2 text-accent",
                  )}>
                    <Icon size={18} />
                  </span>
                  <span className="font-display text-lg font-bold">{m.label}</span>
                </div>
                <p className="mt-2 text-xs text-muted">{m.tagline}</p>
                <ul className="mt-3 space-y-1 text-[11px]">
                  {m.controls.map((c) => (
                    <li key={c} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-md border border-border bg-bg px-2 py-1.5 text-[10px] text-muted">
                  <strong className="text-amber-300">Stakes:</strong> {m.risks}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs italic text-muted">{describeMode(mode)}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">2. Choose your franchise</h2>
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
      </section>

      <div className="sticky bottom-20 z-20 flex justify-end sm:bottom-4">
        <button
          disabled={!picked || loading}
          onClick={start}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-bg shadow-lg tap hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
          {confirmReplace ? "Confirm — replace existing save" : `Start as ${mode}`}
        </button>
      </div>
    </div>
  );
}
