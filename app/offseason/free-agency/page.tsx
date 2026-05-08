"use client";
import { useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor, cn } from "@/lib/utils";
import { GROUP_LABEL, GROUP_ORDER, POSITION_GROUP } from "@/lib/data/positions";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";
import { userCan } from "@/lib/cpu/career";

export default function FreeAgencyPage() {
  const league = useLeague((s) => s.league);
  const signFA = useLeague((s) => s.signFA);
  const [filter, setFilter] = useState<string>("ALL");
  const [picked, setPicked] = useState<string | null>(null);

  if (!league) return <Empty>No league yet.</Empty>;
  if (!league.userTeam) return <Empty>No user team.</Empty>;

  const team = TEAMS_BY_ID[league.userTeam];
  const payroll = currentTeamPayroll(league, team.id);
  const cap = team.cap;
  const canSign = userCan(league, "freeAgency");

  const fas = league.freeAgents
    .map((f) => ({ fa: f, p: league.players[f.playerId] }))
    .filter(({ p }) => p && !p.retired)
    .filter(({ p }) => filter === "ALL" || POSITION_GROUP[p.position] === filter)
    .sort((a, b) => b.p.ovr - a.p.ovr);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Free Agency</h1>
          <p className="text-sm text-muted">Sign free agents — CPU teams will continue bidding when you advance.</p>
        </div>
        <Link href="/offseason" className="rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-surface2">← Offseason</Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Cap room" value={`$${(cap - payroll).toFixed(1)}M`} hint={`$${payroll.toFixed(1)}M used / $${cap}M`} />
        <Stat label="FAs available" value={league.freeAgents.length} />
        <Stat label="Team OVR" value={team.abbr} />
      </div>

      <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {(["ALL", ...GROUP_ORDER] as const).map((g) => (
          <button key={g} onClick={() => setFilter(g)}
            className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
              filter === g ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2")}>
            {g === "ALL" ? "All" : GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <Panel title={`Free Agents (${fas.length})`}>
        <ul className="divide-y divide-border/60">
          {fas.slice(0, 80).map(({ fa, p }) => {
            const overBudget = fa.askAav > cap - payroll;
            return (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Link href={`/player/${p.id}`} className="grid h-9 w-9 place-items-center rounded-md bg-surface2 font-display text-xs font-bold text-muted hover:text-accent">
                  {p.position}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/player/${p.id}`} className="block truncate text-sm font-medium hover:text-accent">{p.firstName} {p.lastName}</Link>
                  <div className="text-[11px] text-muted">Age {p.age} • Asks ${fa.askAav.toFixed(1)}M / {fa.askYears}yr</div>
                </div>
                <div className={`hidden font-mono text-base font-bold sm:block ${gradeColor(p.ovr)}`}>{p.ovr}</div>
                <button
                  onClick={() => signFA(team.id, p.id, fa.askYears, fa.askAav)}
                  disabled={overBudget || !canSign}
                  title={!canSign ? "Your role doesn't manage free agency" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-bold tap",
                    (overBudget || !canSign)
                      ? "cursor-not-allowed border border-border bg-surface2 text-muted"
                      : "bg-accent text-bg hover:opacity-90",
                  )}
                >
                  {!canSign ? "GM only" : overBudget ? "No cap" : "Sign"}
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
