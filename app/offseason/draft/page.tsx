"use client";
import { useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor, cn } from "@/lib/utils";
import { GROUP_LABEL, GROUP_ORDER, POSITION_GROUP } from "@/lib/data/positions";
import { getCombine, SCOUT_COST_PER_PROSPECT } from "@/lib/cpu/scouting";
import { Search, Eye } from "lucide-react";

export default function DraftPage() {
  const league = useLeague((s) => s.league);
  const draft = useLeague((s) => s.draftPlayerForUser);
  const scout = useLeague((s) => s.scoutProspect);
  const [filter, setFilter] = useState<string>("ALL");
  const [scoutMsg, setScoutMsg] = useState<string | null>(null);

  if (!league) return <Empty>No league yet.</Empty>;

  const userTeam = league.userTeam;
  const scoutingPoints = userTeam ? (league.scoutingPoints[userTeam] ?? 0) : 0;

  const userPicks = league.draftPicks
    .filter((dp) => dp.year === league.year && dp.currentTeam === userTeam && !dp.used)
    .sort((a, b) => a.round - b.round || a.pick - b.pick);

  const prospects = league.draftClass
    .filter((p) => !p.team)
    .filter((p) => filter === "ALL" || POSITION_GROUP[p.position] === filter)
    .sort((a, b) => b.scoutGrade - a.scoutGrade);

  const mockDraft = league.mockDraft;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">{league.year} Draft</h1>
          <p className="text-sm text-muted">Spend scouting points to reveal true potential. Combine numbers come standard.</p>
        </div>
        <Link href="/offseason" className="rounded-md border border-border bg-surface px-3 py-2 text-xs hover:bg-surface2">← Offseason</Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Your picks left" value={userPicks.length} />
        <Stat label="Prospects" value={prospects.length} />
        <Stat label="Next pick" value={userPicks[0] ? `R${userPicks[0].round} P${userPicks[0].pick}` : "—"} />
        <Stat label="Scouting points" value={scoutingPoints} hint={`${SCOUT_COST_PER_PROSPECT} pts per prospect`} />
      </div>

      {userPicks.length > 0 && (
        <Panel title="Your remaining picks">
          <div className="flex flex-wrap gap-2">
            {userPicks.map((dp) => (
              <span key={`${dp.round}-${dp.pick}`} className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
                R{dp.round} • P{dp.pick}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {mockDraft && (
        <Panel title={`Latest mock draft (Wk ${mockDraft.publishedWeek})`}>
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {mockDraft.picks.slice(0, 12).map((mp, i) => {
              const team = TEAMS_BY_ID[mp.team];
              const prospect = league.draftClass.find((x) => x.id === mp.prospectId);
              return (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1 text-xs">
                  <span className="grid h-6 w-6 place-items-center rounded bg-surface2 font-mono text-[10px]">{i + 1}</span>
                  <TeamLogo team={team} size={16} />
                  {prospect ? (
                    <Link href={`/player/${prospect.id}`} className="truncate hover:text-accent">
                      {prospect.firstName[0]}. {prospect.lastName} <span className="text-muted">{prospect.position}</span>
                    </Link>
                  ) : <span className="text-muted">—</span>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {scoutMsg && (
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">{scoutMsg}</div>
      )}

      <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {(["ALL", ...GROUP_ORDER] as const).map((g) => (
          <button key={g} onClick={() => setFilter(g)}
            className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
              filter === g ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2")}>
            {g === "ALL" ? "All" : GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <Panel title="Prospect Board">
        <ul className="divide-y divide-border/60">
          {prospects.slice(0, 80).map((p) => {
            const combine = getCombine(p);
            const scouted = league.scoutedProspects.includes(p.id);
            return (
              <li key={p.id} className="py-2">
                <div className="flex items-center gap-3">
                  <Link href={`/player/${p.id}`} className="grid h-9 w-9 place-items-center rounded-md bg-surface2 font-display text-xs font-bold text-muted hover:text-accent">
                    {p.position}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/player/${p.id}`} className="block truncate text-sm font-medium hover:text-accent">
                      {p.firstName} {p.lastName} <span className="text-muted">({p.college})</span>
                    </Link>
                    <div className="flex flex-wrap gap-3 text-[10px] text-muted">
                      <span>Proj. R{p.projectedRound}</span>
                      <span>Age {p.age}</span>
                      {combine && <>
                        <span>40: <span className="font-mono text-fg">{combine.fortyYd.toFixed(2)}s</span></span>
                        <span>Bench: <span className="font-mono text-fg">{combine.bench}</span></span>
                        <span>Vert: <span className="font-mono text-fg">{combine.vertical}"</span></span>
                      </>}
                      {scouted && (
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-bold text-cyan-300">POT {p.pot}</span>
                      )}
                    </div>
                  </div>
                  <div className={`font-mono text-base font-bold ${gradeColor(p.scoutGrade)}`}>{p.scoutGrade}</div>
                  {!scouted && (
                    <button
                      onClick={() => {
                        const r = scout(p.id);
                        setScoutMsg(r.ok ? `Scouted ${p.firstName} ${p.lastName} — POT ${r.revealed?.pot}` : `Failed: ${r.reason}`);
                      }}
                      disabled={scoutingPoints < SCOUT_COST_PER_PROSPECT}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] tap",
                        scoutingPoints >= SCOUT_COST_PER_PROSPECT
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                          : "border-border bg-surface2 text-muted cursor-not-allowed",
                      )}
                      title={scoutingPoints >= SCOUT_COST_PER_PROSPECT ? `Spend ${SCOUT_COST_PER_PROSPECT} scouting points` : "Not enough scouting points"}
                    >
                      <Eye size={11} /> Scout
                    </button>
                  )}
                  <button
                    onClick={() => draft(p.id)}
                    disabled={userPicks.length === 0}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-bold tap",
                      userPicks.length === 0
                        ? "cursor-not-allowed border border-border bg-surface2 text-muted"
                        : "bg-accent text-bg hover:opacity-90",
                    )}
                  >
                    Draft
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
