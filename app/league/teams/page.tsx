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
import { Users, ListTree, ClipboardList, UserCog } from "lucide-react";

export default function TeamsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const ranked = TEAMS.map((t) => ({ t, ovr: teamOvr(league, t.id) })).sort((a, b) => b.ovr - a.ovr);

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title="All 32 Teams — Power Rankings">
        <p className="text-xs text-muted">Click a team for the full page (overview, roster, depth chart, coaches, practice squad, schedule). Or jump straight in via the quick links.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ t, ovr }, i) => {
            const s = league.standings[t.id];
            const roster = getRoster(league, t.id);
            const stars = roster.filter((p) => p.ovr >= 85).length;
            const { hc } = staffOf(league, t.id);
            return (
              <div key={t.id} className="rounded-lg border border-border bg-surface p-3 hover:border-accent/40">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 font-display text-sm font-bold">{i + 1}</span>
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
