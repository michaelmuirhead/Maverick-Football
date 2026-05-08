"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";

export default function CompPicksPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  const upcomingYear = league.year + 1;
  const currentComps = (league.compPicks ?? []).filter((c) => c.year === upcomingYear);
  const allComps = (league.compPicks ?? []).slice().reverse();
  const userTeam = league.userTeam;

  return (
    <div className="space-y-4">
      <LeagueNav />

      <Section title={`Compensatory Picks — ${upcomingYear} draft`}>
        <Panel title="How comp picks are awarded">
          <ul className="space-y-1.5 text-xs text-muted">
            <li>• Teams that lose <strong className="text-fg">more FA value than they sign</strong> qualify for comp picks the next year.</li>
            <li>• Round depends on the biggest FA loss:</li>
            <li className="ml-4">— $18M+ AAV or 88+ OVR → <strong className="text-emerald-300">3rd-round</strong> pick</li>
            <li className="ml-4">— $12M+ AAV or 82+ OVR → <strong className="text-emerald-300">4th-round</strong></li>
            <li className="ml-4">— $8M+ AAV or 78+ OVR → <strong className="text-emerald-300">5th-round</strong></li>
            <li className="ml-4">— $5M+ AAV → <strong className="text-emerald-300">6th-round</strong></li>
            <li className="ml-4">— Other qualifying losses → <strong className="text-emerald-300">7th-round</strong></li>
            <li>• Comp picks are added <strong className="text-fg">after the regular slot</strong> in their round.</li>
            <li>• A team must have a <strong className="text-fg">net loss of $5M+ AAV</strong> to qualify.</li>
          </ul>
        </Panel>

        {currentComps.length === 0 ? (
          <Empty>No comp picks awarded for next year's draft yet — they're calculated after free agency.</Empty>
        ) : (
          <Panel title={`${upcomingYear} comp picks (${currentComps.length})`}>
            <ul className="divide-y divide-border/60">
              {currentComps
                .slice()
                .sort((a, b) => a.round - b.round)
                .map((c, i) => {
                  const t = TEAMS_BY_ID[c.team];
                  const isUser = c.team === userTeam;
                  return (
                    <li key={i} className={`flex items-center gap-3 py-2 ${isUser ? "bg-accent/5 -mx-3 px-3 rounded" : ""}`}>
                      <span className="rounded bg-emerald-500/15 px-2 py-1 font-mono text-xs font-bold text-emerald-300">R{c.round}</span>
                      <TeamLogo team={t} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{t.city} {t.name}</div>
                        <div className="text-[11px] text-muted">{c.rationale}</div>
                      </div>
                      {isUser && <span className="text-[10px] font-bold text-accent">YOUR TEAM</span>}
                    </li>
                  );
                })}
            </ul>
          </Panel>
        )}
      </Section>

      {userTeam && (
        <Section title="Your team's comp pick history">
          {(() => {
            const userHistory = (league.compPicks ?? []).filter((c) => c.team === userTeam).slice().reverse();
            return userHistory.length === 0 ? (
              <Empty>Your team hasn't received any comp picks yet.</Empty>
            ) : (
              <ul className="space-y-1">
                {userHistory.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 text-sm">
                    <span className="font-mono text-muted">{c.year}</span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">R{c.round}</span>
                    <span className="flex-1 text-xs text-muted">{c.rationale}</span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </Section>
      )}

      <Section title="All league comp picks (recent)">
        {allComps.length === 0 ? (
          <Empty>No comp picks recorded yet.</Empty>
        ) : (
          <Panel>
            <ul className="divide-y divide-border/60">
              {allComps.slice(0, 30).map((c, i) => {
                const t = TEAMS_BY_ID[c.team];
                return (
                  <li key={i} className="flex items-center gap-3 py-2 text-xs">
                    <span className="font-mono text-muted">{c.year}</span>
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono font-bold text-emerald-300">R{c.round}</span>
                    <TeamLogo team={t} size={18} />
                    <Link href={`/team/${t.id}`} className="font-medium hover:text-accent">{t.abbr}</Link>
                    <span className="flex-1 truncate text-muted">{c.rationale}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </Section>
    </div>
  );
}
