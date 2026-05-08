"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Section, Empty } from "@/components/panels";
import { TEAMS } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { teamOvr, getRoster } from "@/lib/gen/roster";
import { staffOf } from "@/lib/cpu/coaches";
import { gradeColor } from "@/lib/utils";
import { Users, ListTree, ClipboardList, UserCog, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { computePowerRankings, rankingMovement } from "@/lib/cpu/powerRankings";

export default function TeamsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  // Power rankings from snapshot if available, else fallback to OVR sort
  const rankedIds = (league.powerRankingHistory && league.powerRankingHistory.length > 0)
    ? league.powerRankingHistory[league.powerRankingHistory.length - 1].rankings
    : computePowerRankings(league);
  const movement = rankingMovement(league);
  const ranked = rankedIds.map((id) => {
    const t = TEAMS.find((x) => x.id === id);
    return t ? { t, ovr: teamOvr(league, id), move: movement[id] ?? 0 } : null;
  }).filter((x): x is { t: typeof TEAMS[0]; ovr: number; move: number } => !!x);

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title="All 32 Teams — Power Rankings">
        <p className="text-xs text-muted">Click a team for the full page (overview, roster, depth chart, coaches, practice squad, schedule). Arrows show week-over-week movement.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ t, ovr, move }, i) => {
            const s = league.standings[t.id];
            const roster = getRoster(league, t.id);
            const stars = roster.filter((p) => p.ovr >= 85).length;
            const { hc } = staffOf(league, t.id);
            return (
              <div key={t.id} className="rounded-lg border border-border bg-surface p-3 hover:border-accent/40">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 font-display text-sm font-bold">{i + 1}</span>
                  <MovementArrow move={move} />
                  <TeamLogo team={t} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/team/${t.id}`} className="block truncate font-medium hover:text-accent">{t.city} {t.name}</Link>
                    <div className="text-[11px] text-muted">
                      {t.conference} {t.division} • {s.w}-{s.l}{s.t > 0 ? `-${s.t}` : ""} • {stars} star{stars === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className={`font-mono text-lg font-bold ${gradeColor(ovr)}`}>{ovr}</span>
                </div>

                {hc && (
                  <div className="mt-2 truncate text-[11px] text-muted">
                    HC: <Link href={`/team/${t.id}/coaches`} className="hover:text-accent">{hc.firstName} {hc.lastName}</Link>
                    <span className="ml-1">· {hc.careerWins}-{hc.careerLosses}</span>
                    {hc.championships > 0 && <span className="ml-1 text-fuchsia-300">· ★{hc.championships}</span>}
                  </div>
                )}

                <div className="mt-2 grid grid-cols-4 gap-1">
                  <QuickLink href={`/team/${t.id}`} icon={<Users size={11} />} label="Overview" />
                  <QuickLink href={`/team/${t.id}/roster`} icon={<ListTree size={11} />} label="Roster" />
                  <QuickLink href={`/team/${t.id}/coaches`} icon={<UserCog size={11} />} label="Coaches" />
                  <QuickLink href={`/team/${t.id}/schedule`} icon={<ClipboardList size={11} />} label="Sched" />
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-center gap-1 rounded border border-border bg-bg px-1 py-1 text-[10px] text-muted hover:border-accent/40 hover:text-accent tap">
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MovementArrow({ move }: { move: number }) {
  if (move > 0) {
    return (
      <span className="flex items-center gap-0.5 text-emerald-400" title={`Up ${move}`}>
        <ArrowUp size={12} />
        <span className="text-[10px] font-mono">{move}</span>
      </span>
    );
  }
  if (move < 0) {
    return (
      <span className="flex items-center gap-0.5 text-red-400" title={`Down ${-move}`}>
        <ArrowDown size={12} />
        <span className="text-[10px] font-mono">{-move}</span>
      </span>
    );
  }
  return (
    <span className="text-muted/50" title="No change">
      <Minus size={12} />
    </span>
  );
}
