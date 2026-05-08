"use client";
import Link from "next/link";
import type { League, StandingsRow } from "@/lib/types";
import { TEAMS_BY_ID, teamsInDivision } from "@/lib/data/teams";
import { TeamLogo } from "./team-logo";
import { sortStandingsTeams } from "@/lib/sim/season";

export function StandingsTable({ league }: { league: League }) {
  const conferences = ["AFC", "NFC"] as const;
  const divisions = ["East", "North", "South", "West"] as const;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {conferences.map((conf) => (
        <div key={conf} className="space-y-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-fg">{conf}</h2>
          {divisions.map((div) => {
            const rows = sortStandingsTeams(
              teamsInDivision(conf, div).map((t) => league.standings[t.id])
            );
            return (
              <div key={div} className="rounded-lg border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs uppercase tracking-wider text-muted">
                  <span>{conf} {div}</span>
                  <span>W L T • Div • PF/PA</span>
                </div>
                <ul className="divide-y divide-border/60">
                  {rows.map((r) => <Row key={r.team} row={r} />)}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Row({ row }: { row: StandingsRow }) {
  const t = TEAMS_BY_ID[row.team];
  return (
    <li>
      <Link href={`/team/${t.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-surface2 tap">
        <TeamLogo team={t} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{t.city} {t.name}</div>
          <div className="text-[11px] text-muted">{row.streak || "—"}</div>
        </div>
        <div className="font-mono text-sm tabular-nums">
          <span className="font-bold">{row.w}</span>
          <span className="text-muted">-{row.l}</span>
          {row.t > 0 && <span className="text-muted">-{row.t}</span>}
        </div>
        <div className="hidden w-16 text-right font-mono text-xs text-muted tabular-nums sm:block">
          {row.divW}-{row.divL}
        </div>
        <div className="hidden w-20 text-right font-mono text-xs text-muted tabular-nums sm:block">
          {row.pf}/{row.pa}
        </div>
      </Link>
    </li>
  );
}
