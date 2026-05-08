"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Section, Empty } from "@/components/panels";
import { TEAMS } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { teamOvr } from "@/lib/gen/roster";
import { gradeColor } from "@/lib/utils";

export default function TeamsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const ranked = TEAMS.map((t) => ({ t, ovr: teamOvr(league, t.id) })).sort((a, b) => b.ovr - a.ovr);

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title="Power Rankings">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ t, ovr }, i) => {
            const s = league.standings[t.id];
            return (
              <Link key={t.id} href={`/team/${t.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:bg-surface2 tap">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 font-display text-sm font-bold">{i + 1}</span>
                <TeamLogo team={t} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.city} {t.name}</div>
                  <div className="text-[11px] text-muted">{t.conference} {t.division} • {s.w}-{s.l}{s.t > 0 ? `-${s.t}` : ""}</div>
                </div>
                <span className={`font-mono text-lg font-bold ${gradeColor(ovr)}`}>{ovr}</span>
              </Link>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
