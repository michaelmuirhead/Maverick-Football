"use client";
import Link from "next/link";
import { use } from "react";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { Panel, Stat, Section, Empty } from "@/components/panels";
import { GameCard } from "@/components/game-card";
import { PlayerRow } from "@/components/player-row";
import { teamOvr, getRoster } from "@/lib/gen/roster";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";
import { TeamNav } from "@/components/team-nav";
import { PhilosophyPanel } from "@/components/philosophy-panel";
import { Activity } from "lucide-react";

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const roster = getRoster(league, team.id);
  const ovr = teamOvr(league, team.id);
  const payroll = currentTeamPayroll(league, team.id);
  const standing = league.standings[team.id];

  const next = league.schedule
    .filter((g) => g.year === league.year && !g.played && (g.home === team.id || g.away === team.id))
    .sort((a, b) => a.week - b.week)[0];
  const recent = league.schedule
    .filter((g) => g.year === league.year && g.played && (g.home === team.id || g.away === team.id))
    .sort((a, b) => b.week - a.week)
    .slice(0, 3);

  const stars = roster.filter((p) => p.ovr >= 85).slice(0, 6);

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle={`Team OVR ${ovr} • ${standing.w}-${standing.l}${standing.t > 0 ? `-${standing.t}` : ""} • Cap $${payroll.toFixed(1)}M / $${team.cap}M`} />

      <TeamNav teamId={team.id} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Team OVR" value={ovr} />
        <Stat label="Record" value={`${standing.w}-${standing.l}${standing.t > 0 ? `-${standing.t}` : ""}`} hint={`Streak: ${standing.streak || "—"}`} />
        <Stat label="Points For" value={standing.pf} hint={`Allowed: ${standing.pa}`} />
        <Stat label="Cap" value={`$${payroll.toFixed(1)}M`} hint={`/ $${team.cap}M`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Next up">
          {next ? <GameCard game={next} accent={team.id} /> : <Empty>Season finished.</Empty>}
        </Panel>
        <Panel title="Recent">
          {recent.length ? (
            <div className="space-y-2">
              {recent.map((g) => <GameCard key={g.id} game={g} accent={team.id} />)}
            </div>
          ) : <Empty>No games yet.</Empty>}
        </Panel>
      </div>

      <Section title="Stars" action={<Link href={`/team/${team.id}/roster`} className="text-xs text-muted hover:text-fg">Full roster →</Link>}>
        <div className="grid gap-1 sm:grid-cols-2">
          {stars.map((p) => <PlayerRow key={p.id} player={p} />)}
          {stars.length === 0 && <Empty>No 85+ OVR players. Get scouting!</Empty>}
        </div>
      </Section>

      <InjuryReport teamId={team.id} />

      <DeadCapPanel teamId={team.id} />

      <PhilosophyPanel teamId={team.id} />

      <FranchiseHallPanel teamId={team.id} />

      <PointsTrendChart teamId={team.id} />
    </div>
  );
}

function InjuryReport({ teamId }: { teamId: string }) {
  const league = useLeague((s) => s.league)!;
  const injured = Object.values(league.players).filter(
    (p) => p.team === teamId && (p.injury || p.onIR),
  );
  if (!injured.length) return null;
  return (
    <Panel title={`Injury report (${injured.length})`}>
      <ul className="divide-y divide-border/60">
        {injured.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-1.5 text-xs">
            <Activity size={12} className="shrink-0 text-red-400" />
            <Link href={`/player/${p.id}`} className="flex-1 truncate hover:text-accent">
              {p.firstName} {p.lastName} <span className="text-muted">({p.position})</span>
            </Link>
            <span className="text-muted">
              {p.injury ? `${p.injury.type} · ${p.injury.weeks}w` : "Recovering"}
            </span>
            {p.onIR && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">IR</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DeadCapPanel({ teamId }: { teamId: string }) {
  const league = useLeague((s) => s.league)!;
  const entries = (league.deadCap[teamId] ?? []).filter((d) => d.year >= league.year);
  if (entries.length === 0) return null;
  return (
    <Panel title="Dead cap">
      <ul className="space-y-1 text-xs">
        {entries.map((d, i) => (
          <li key={i} className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2">
            <span className="truncate">{d.playerName}</span>
            <span className="text-muted">{d.year}</span>
            <span className="font-mono">${d.amount.toFixed(1)}M</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function FranchiseHallPanel({ teamId }: { teamId: string }) {
  const league = useLeague((s) => s.league)!;
  const fr = league.franchises[teamId];
  if (!fr) return null;
  if (fr.hof.length === 0 && fr.retiredNumbers.length === 0) return null;
  return (
    <Section title="Franchise legacy">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={`Franchise HoF (${fr.hof.length})`}>
          {fr.hof.length === 0 ? <Empty>No inductees yet.</Empty> : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {fr.hof.map((id) => {
                const p = league.players[id];
                if (!p) return null;
                return (
                  <li key={id}>
                    <Link href={`/player/${id}`} className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-1.5 text-xs hover:bg-surface2">
                      <span className="truncate">{p.firstName} {p.lastName}</span>
                      <span className="text-muted">{p.position}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title={`Retired numbers (${fr.retiredNumbers.length})`}>
          {fr.retiredNumbers.length === 0 ? <Empty>No retired numbers.</Empty> : (
            <ul className="grid gap-1 grid-cols-2 sm:grid-cols-3">
              {fr.retiredNumbers.map((rn) => {
                const p = league.players[rn.playerId];
                return (
                  <li key={rn.jersey} className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/5 p-2 text-center">
                    <div className="font-display text-2xl font-bold text-fuchsia-300">#{rn.jersey}</div>
                    {p && <Link href={`/player/${rn.playerId}`} className="text-[10px] text-muted hover:text-accent">{p.firstName} {p.lastName}</Link>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </Section>
  );
}

function PointsTrendChart({ teamId }: { teamId: string }) {
  const league = useLeague((s) => s.league)!;
  const games = league.schedule
    .filter((g) => g.year === league.year && g.played && (g.home === teamId || g.away === teamId))
    .sort((a, b) => a.week - b.week);
  if (games.length < 2) return null;

  const points = games.map((g) => {
    const isHome = g.home === teamId;
    const pf = isHome ? g.result!.homeScore : g.result!.awayScore;
    const pa = isHome ? g.result!.awayScore : g.result!.homeScore;
    return { week: g.week, pf, pa };
  });

  const W = 600, H = 160, P = 24;
  const maxY = Math.max(...points.flatMap((p) => [p.pf, p.pa]), 35);
  const stepX = (W - P * 2) / Math.max(points.length - 1, 1);
  const yScale = (v: number) => H - P - (v / maxY) * (H - P * 2);
  const path = (key: "pf" | "pa") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${P + i * stepX} ${yScale(p[key])}`).join(" ");

  return (
    <Panel title={`Points trend — ${league.year}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="currentColor" opacity={0.2} />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="currentColor" opacity={0.2} />
        {[10, 20, 30].filter((v) => v <= maxY).map((v) => (
          <g key={v}>
            <line x1={P} y1={yScale(v)} x2={W - P} y2={yScale(v)} stroke="currentColor" opacity={0.06} />
            <text x={P - 4} y={yScale(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="currentColor" opacity={0.5}>{v}</text>
          </g>
        ))}
        <path d={path("pf")} fill="none" stroke="rgb(245 158 11)" strokeWidth={2} />
        <path d={path("pa")} fill="none" stroke="rgb(239 68 68)" strokeWidth={2} strokeDasharray="4 3" opacity={0.85} />
      </svg>
      <div className="mt-2 flex gap-3 text-[11px] text-muted">
        <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "rgb(245 158 11)" }} /> Points For</span>
        <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "rgb(239 68 68)" }} /> Points Allowed</span>
      </div>
    </Panel>
  );
}
