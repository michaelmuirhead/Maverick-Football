"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section } from "@/components/panels";
import { LeagueNav } from "@/components/league-nav";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor } from "@/lib/utils";

export default function AllDecadePage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const teams = (league.allDecadeTeams ?? []).slice().reverse();

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title="All-Decade Teams">
        {teams.length === 0 ? (
          <Empty>The first all-decade team is named after 10 simulated seasons.</Empty>
        ) : (
          <div className="space-y-4">
            {teams.map((dt) => (
              <Panel key={dt.decade} title={`${dt.decade}s All-Decade Team`} action={<span className="text-xs text-muted">named {dt.awarded}</span>}>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {dt.slots.map((slot, i) => {
                    const p = league.players[slot.playerId];
                    if (!p) return null;
                    const team = p.team ? TEAMS_BY_ID[p.team] : null;
                    return (
                      <Link key={i} href={`/player/${p.id}`} className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 hover:bg-surface2 hover:border-accent/40 tap">
                        <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{slot.position}</span>
                        {team && <TeamLogo team={team} size={18} />}
                        <span className="flex-1 truncate text-sm">{p.firstName} {p.lastName}</span>
                        <span className={`font-mono text-xs font-bold ${gradeColor(p.ovr)}`}>{p.ovr}</span>
                      </Link>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
