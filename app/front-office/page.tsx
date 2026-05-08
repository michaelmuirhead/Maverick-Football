"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor, cn } from "@/lib/utils";
import {
  ArrowLeftRight, ChevronRight, Eye, Search, Briefcase, ListTree, Tv, AlertTriangle,
} from "lucide-react";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";
import { userCan } from "@/lib/cpu/career";

export default function FrontOfficePage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  const career = league.userCareer;
  const isFired = career?.status === "Fired";
  const isYearOff = career?.status === "TakingYearOff";
  const onHotSeat = career?.status === "OnHotSeat";

  // If user has no team (fired / sitting out), show career-focused view instead
  if (!league.userTeam) {
    return (
      <div className="space-y-4">
        <header className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-300" />
            <div className="flex-1">
              <h1 className="font-display text-xl font-bold">{isFired ? "Free agent" : isYearOff ? "Sitting out" : "No team"}</h1>
              <p className="text-xs text-muted">{career?.mode} — {career ? `Reputation ${career.reputation}` : ""}</p>
            </div>
            <Link href="/career" className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-bold text-bg tap hover:opacity-90">
              Open career page <ChevronRight size={12} />
            </Link>
          </div>
        </header>
        <Empty>
          You don't have a team to manage right now. Visit your <Link href="/career" className="text-accent hover:underline">career page</Link> to review job offers, take a year off, or retire.
        </Empty>
      </div>
    );
  }

  const userTeam = TEAMS_BY_ID[league.userTeam];
  const payroll = currentTeamPayroll(league, userTeam.id);
  const capRoom = userTeam.cap - payroll;
  const userPicks = league.draftPicks
    .filter((dp) => dp.year === league.year && dp.currentTeam === userTeam.id && !dp.used)
    .sort((a, b) => a.round - b.round || a.pick - b.pick);
  const inbox = league.pendingOffers.filter(
    (o) => o.status === "pending" && (o.toTeam === userTeam.id || o.fromTeam === userTeam.id),
  );
  const scoutPts = league.scoutingPoints[userTeam.id] ?? 0;

  const phase = league.phase;
  const tradeWindowOpen =
    (phase === "RegularSeason" && league.week <= 9) || phase.startsWith("Offseason");
  const draftOpen = phase === "Offseason:Draft" || phase === "Offseason:Done";
  const faOpen = phase === "Offseason:FreeAgency" || phase === "Offseason:Done";

  const topFAs = league.freeAgents
    .map((f) => ({ fa: f, p: league.players[f.playerId] }))
    .filter(({ p }) => p && !p.retired)
    .sort((a, b) => b.p.ovr - a.p.ovr)
    .slice(0, 12);

  const topProspects = league.draftClass
    .filter((p) => !p.team)
    .sort((a, b) => b.scoutGrade - a.scoutGrade)
    .slice(0, 12);

  const recentTrades = league.tradeLog.slice(0, 5);

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Briefcase size={20} className="text-accent" />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">Front Office</h1>
            <p className="text-xs text-muted">All GM tools in one place — trades, FA, draft, scouting.</p>
          </div>
          <TeamLogo team={userTeam} size={32} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <PhaseBadge label="Trade window" open={tradeWindowOpen} />
          <PhaseBadge label="Free agency" open={faOpen} />
          <PhaseBadge label="Draft" open={draftOpen} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Stat label="Cap room" value={`$${capRoom.toFixed(1)}M`} hint={`$${payroll.toFixed(1)}M / $${userTeam.cap}M`} />
          <Stat label="Trade inbox" value={inbox.length} hint={inbox.length > 0 ? "pending offers" : "no offers"} />
          <Stat label="Your picks" value={userPicks.length} hint={userPicks[0] ? `Next R${userPicks[0].round} P${userPicks[0].pick}` : "—"} />
          <Stat label="Scouting" value={scoutPts} hint="points" />
        </div>
      </header>

      {/* Trade Center */}
      <Section
        title="Trade Center"
        action={
          <Link href="/trade-center" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Open Trade Center <ChevronRight size={12} />
          </Link>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Panel title="Pending offers">
            {inbox.length === 0 ? (
              <Empty>No pending offers.</Empty>
            ) : (
              <ul className="space-y-1.5">
                {inbox.slice(0, 4).map((o) => {
                  const partner = TEAMS_BY_ID[o.fromTeam === userTeam.id ? o.toTeam : o.fromTeam];
                  return (
                    <li key={o.id} className="flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs">
                      <ArrowLeftRight size={12} className="text-accent" />
                      <TeamLogo team={partner} size={16} />
                      <span className="flex-1 truncate">{o.message ?? `Offer from ${partner.name}`}</span>
                      <Link href="/trade-center" className="text-accent hover:underline">Review</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Recent league trades">
            {recentTrades.length === 0 ? (
              <Empty>No trades yet.</Empty>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {recentTrades.map((tr) => {
                  const a = TEAMS_BY_ID[tr.teamA];
                  const b = TEAMS_BY_ID[tr.teamB];
                  return (
                    <li key={tr.id} className="flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1.5">
                      <TeamLogo team={a} size={16} />
                      <ArrowLeftRight size={10} className="text-muted" />
                      <TeamLogo team={b} size={16} />
                      <span className="flex-1 truncate text-muted">
                        {tr.year}{tr.week ? ` W${tr.week}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </Section>

      {/* Free Agency */}
      <Section
        title="Free Agency"
        action={
          <Link href="/offseason/free-agency" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Open FA market <ChevronRight size={12} />
          </Link>
        }
      >
        {topFAs.length === 0 ? (
          <Empty>
            {faOpen ? "FA pool is empty right now." : "Free agency opens during the offseason. The pool refreshes after each season."}
          </Empty>
        ) : (
          <Panel>
            <ul className="divide-y divide-border/60">
              {topFAs.map(({ fa, p }) => (
                <li key={p.id} className="flex items-center gap-2 py-1.5">
                  <Link href={`/player/${p.id}`} className="grid h-8 w-10 place-items-center rounded bg-surface2 font-mono text-[10px] text-muted hover:text-accent">
                    {p.position}
                  </Link>
                  <Link href={`/player/${p.id}`} className="flex-1 truncate text-sm hover:text-accent">
                    {p.firstName} {p.lastName}
                  </Link>
                  <span className="hidden text-[11px] text-muted sm:inline">Age {p.age}</span>
                  <span className="font-mono text-[11px] text-muted">${fa.askAav.toFixed(1)}M</span>
                  <span className={`font-mono text-sm font-bold ${gradeColor(p.ovr)}`}>{p.ovr}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Section>

      {/* Draft */}
      <Section
        title={`Draft Prospects — ${league.year + 1} class`}
        action={
          <Link href="/offseason/draft" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Open Draft Board <ChevronRight size={12} />
          </Link>
        }
      >
        {topProspects.length === 0 ? (
          <Empty>No draft class generated yet.</Empty>
        ) : (
          <Panel>
            <ul className="divide-y divide-border/60">
              {topProspects.map((p) => {
                const scouted = league.scoutedProspects.includes(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2 py-1.5">
                    <Link href={`/player/${p.id}`} className="grid h-8 w-10 place-items-center rounded bg-surface2 font-mono text-[10px] text-muted hover:text-accent">
                      {p.position}
                    </Link>
                    <Link href={`/player/${p.id}`} className="flex-1 truncate text-sm hover:text-accent">
                      {p.firstName} {p.lastName} <span className="text-muted">({p.college})</span>
                    </Link>
                    <span className="hidden text-[11px] text-muted sm:inline">Proj. R{p.projectedRound}</span>
                    {scouted && <Eye size={12} className="text-cyan-300" />}
                    <span className={`font-mono text-sm font-bold ${gradeColor(p.scoutGrade)}`}>{p.scoutGrade}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </Section>

      {/* Scouting + Mock Draft */}
      <Section
        title="Scouting & Mock Drafts"
        action={
          <Link href="/offseason/draft" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
            Scout prospects <ChevronRight size={12} />
          </Link>
        }
      >
        <div className="grid gap-2 lg:grid-cols-2">
          <Panel title="Your scouting budget">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Stat label="Points available" value={scoutPts} />
              <span className="text-muted">Spend points to reveal a prospect's true potential.</span>
            </div>
            <Link
              href="/offseason/draft"
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
            >
              <Search size={12} /> Open scouting board
            </Link>
          </Panel>

          <Panel title={league.mockDraft ? `Latest mock draft (Wk ${league.mockDraft.publishedWeek})` : "Mock drafts"}>
            {!league.mockDraft ? (
              <Empty>Mock drafts publish from Week 6 of the regular season.</Empty>
            ) : (
              <ul className="grid gap-1 sm:grid-cols-2">
                {league.mockDraft.picks.slice(0, 8).map((mp, i) => {
                  const team = TEAMS_BY_ID[mp.team];
                  const prospect = league.draftClass.find((x) => x.id === mp.prospectId);
                  return (
                    <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1 text-xs">
                      <span className="grid h-5 w-5 place-items-center rounded bg-surface2 font-mono text-[10px]">{i + 1}</span>
                      <TeamLogo team={team} size={14} />
                      {prospect ? (
                        <Link href={`/player/${prospect.id}`} className="truncate hover:text-accent">
                          {prospect.firstName[0]}. {prospect.lastName}
                        </Link>
                      ) : <span className="text-muted">—</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </Section>

      {/* Quick links */}
      <Section title="More tools">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/league/teams" icon={<ListTree size={16} />} label="All 32 teams" hint="Power rankings + drill-in" />
          <QuickLink href="/league/coaching-tree" icon={<ListTree size={16} />} label="Coaching trees" hint="Mentorships across the league" />
          <QuickLink href="/league/records" icon={<ListTree size={16} />} label="Records book" hint="All-time leaders" />
          <QuickLink href="/saves" icon={<ListTree size={16} />} label="Saves" hint="Switch / export your dynasty" />
        </div>
      </Section>
    </div>
  );
}

function PhaseBadge({ label, open }: { label: string; open: boolean }) {
  return (
    <div className={cn(
      "rounded-md border px-3 py-2 text-xs",
      open ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
    )}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-bold">{open ? "OPEN" : "CLOSED"}</div>
    </div>
  );
}

function QuickLink({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:bg-surface2 hover:border-accent/40 tap">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="truncate text-[11px] text-muted">{hint}</div>
      </div>
      <ChevronRight size={14} className="text-muted" />
    </Link>
  );
}
