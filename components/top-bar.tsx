"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { Save, ArrowLeftRight, FolderOpen } from "lucide-react";

export function TopBar() {
  const league = useLeague((s) => s.league);
  const saveNow = useLeague((s) => s.saveNow);

  const userTeam = league?.userTeam ? TEAMS_BY_ID[league.userTeam] : null;
  const phaseLabel = league ? formatPhase(league) : "Loading…";
  const pendingOffers = league?.pendingOffers?.filter(
    (o) => o.status === "pending" && (o.toTeam === league.userTeam || o.fromTeam === league.userTeam),
  ).length ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="flex items-center gap-3 px-3 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-bg">M</span>
          <span className="hidden sm:inline">Maverick Football</span>
        </Link>

        {league && (
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <Link
              href="/trade-center"
              className="relative hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-surface sm:flex"
              title="Trade Center"
            >
              <ArrowLeftRight size={12} />
              <span className="text-fg">Trades</span>
              {pendingOffers > 0 && (
                <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                  {pendingOffers}
                </span>
              )}
            </Link>
            <Link
              href="/saves"
              className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-surface sm:flex"
              title="Saves"
            >
              <FolderOpen size={12} />
              <span className="text-fg">Saves</span>
            </Link>
            {userTeam && (
              <span
                className="hidden items-center gap-2 rounded-md border border-border px-2 py-1 sm:flex"
                style={{ borderColor: userTeam.primary }}
              >
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ background: userTeam.primary, outline: `1px solid ${userTeam.secondary}` }}
                />
                <span className="text-fg">{userTeam.city} {userTeam.name}</span>
              </span>
            )}
            <span className="rounded-md border border-border px-2 py-1 text-fg">{phaseLabel}</span>
            <button
              onClick={() => void saveNow()}
              className="grid h-8 w-8 place-items-center rounded-md border border-border tap hover:bg-surface"
              title="Save now"
            >
              <Save size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function formatPhase(l: { year: number; week: number; phase: string }) {
  if (l.phase === "RegularSeason") return `${l.year} • Wk ${l.week}`;
  if (l.phase === "Playoffs") {
    const round = l.week === 19 ? "Wild Card" : l.week === 20 ? "Divisional" : l.week === 21 ? "Conf Champ" : l.week === 22 ? "Super Bowl" : "Playoffs";
    return `${l.year} • ${round}`;
  }
  if (l.phase.startsWith("Offseason")) return `${l.year} Offseason`;
  return l.phase;
}
