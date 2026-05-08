"use client";
import { use } from "react";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { Empty, Panel, Section } from "@/components/panels";
import { TeamNav } from "@/components/team-nav";
import { getRoster } from "@/lib/gen/roster";
import { GROUP_LABEL, GROUP_ORDER, POSITIONS, POSITION_GROUP, POSITION_LABEL } from "@/lib/data/positions";
import Link from "next/link";
import { gradeColor } from "@/lib/utils";
import type { Position } from "@/lib/types";

export default function DepthChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  const setStarter = useLeague((s) => s.setStarter);
  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const roster = getRoster(league, team.id);
  const isUser = league.userTeam === team.id;

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle={`Depth chart — ${roster.length} players`} />
      <TeamNav teamId={team.id} />

      <Section title="Depth Chart">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {GROUP_ORDER.map((g) => (
            <Panel key={g} title={GROUP_LABEL[g]}>
              <div className="space-y-2">
                {POSITIONS.filter((p) => POSITION_GROUP[p] === g).map((pos) => {
                  const players = roster.filter((p) => p.position === pos).sort((a, b) =>
                    (a.depth === "Starter" ? 0 : a.depth === "Backup" ? 1 : 2) -
                    (b.depth === "Starter" ? 0 : b.depth === "Backup" ? 1 : 2) || (b.ovr - a.ovr)
                  );
                  if (!players.length) return null;
                  return (
                    <div key={pos}>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {POSITION_LABEL[pos as Position]}
                      </div>
                      <ul className="space-y-1">
                        {players.slice(0, 4).map((p, i) => (
                          <li key={p.id} className="flex items-center gap-2 rounded bg-surface2/60 px-2 py-1">
                            <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold"
                                  style={{ background: i === 0 ? "rgb(34 197 94 / 0.25)" : i === 1 ? "rgb(234 179 8 / 0.25)" : "rgb(115 115 115 / 0.25)" }}>
                              {i + 1}
                            </span>
                            <Link href={`/player/${p.id}`} className="flex-1 truncate text-xs hover:text-accent">
                              {p.firstName[0]}. {p.lastName}
                            </Link>
                            {p.injuryWeeks > 0 && <span className="text-[10px] text-red-400">INJ {p.injuryWeeks}w</span>}
                            <span className={`font-mono text-xs ${gradeColor(p.ovr)}`}>{p.ovr}</span>
                            {isUser && i !== 0 && (
                              <button onClick={() => setStarter(team.id, pos, p.id)}
                                className="rounded border border-border px-1 py-0.5 text-[9px] hover:border-accent hover:text-accent">
                                ↑
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  );
}
