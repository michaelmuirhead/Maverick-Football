"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section } from "@/components/panels";
import { LeagueNav } from "@/components/league-nav";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor } from "@/lib/utils";

export default function HallOfFamePage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  const inductees = league.hall
    .map((id) => league.players[id])
    .filter(Boolean)
    .sort((a, b) => (b.hofYear ?? 0) - (a.hofYear ?? 0));

  const champions = league.history.slice().reverse();

  return (
    <div className="space-y-4">
      <LeagueNav />

      <Section title="Champions">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-surface2 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Year</th>
                <th className="px-3 py-2 text-left">Champion</th>
                <th className="px-3 py-2 text-left">Runner-Up</th>
                <th className="px-3 py-2 text-left">MVP</th>
              </tr>
            </thead>
            <tbody>
              {champions.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">No champions yet.</td></tr>
              )}
              {champions.map((c) => {
                const champ = TEAMS_BY_ID[c.champion];
                const ru = TEAMS_BY_ID[c.runnerUp];
                const mvp = league.awards.find((a) => a.year === c.year && a.type === "MVP");
                const mvpPlayer = mvp ? league.players[mvp.playerId] : null;
                return (
                  <tr key={c.year} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{c.year}</td>
                    <td className="px-3 py-2">
                      <Link href={`/team/${champ.id}`} className="flex items-center gap-2 hover:text-accent">
                        <TeamLogo team={champ} size={20} />
                        <span>{champ.city} {champ.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      <Link href={`/team/${ru.id}`} className="flex items-center gap-2 hover:text-accent">
                        <TeamLogo team={ru} size={20} />
                        <span>{ru.city} {ru.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {mvpPlayer ? (
                        <Link href={`/player/${mvpPlayer.id}`} className="hover:text-accent">{mvpPlayer.firstName} {mvpPlayer.lastName}</Link>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Hall of Fame">
        {inductees.length === 0 ? (
          <Empty>No inductees yet. Build a legacy.</Empty>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inductees.map((p) => (
              <Link key={p.id} href={`/player/${p.id}`} className="rounded-lg border border-fuchsia-500/30 bg-surface p-3 hover:bg-surface2 tap">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-md bg-fuchsia-500/15 font-display text-xs font-bold text-fuchsia-300">
                    {p.position}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{p.firstName} {p.lastName}</div>
                    <div className="text-[11px] text-muted">
                      Inducted {p.hofYear} • {p.history.length} seasons
                    </div>
                    <div className="text-[10px] text-muted">
                      {p.history.filter((h) => h.proBowl).length} PB • {p.history.filter((h) => h.allPro).length} AP1 • {p.history.filter((h) => h.mvp).length} MVP
                    </div>
                  </div>
                  <div className={`font-mono text-lg font-bold ${gradeColor(p.ovr)}`}>{p.ovr}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
