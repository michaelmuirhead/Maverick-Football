"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Empty, Panel, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { RECORD_LABELS, RECORD_CATEGORIES } from "@/lib/cpu/records";

export default function RecordsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title="All-Time Records">
        <div className="grid gap-3 lg:grid-cols-3">
          <RecordCol title="Career" book={league.records.career} />
          <RecordCol title="Single Season" book={league.records.season} />
          <RecordCol title="Single Game" book={league.records.game} />
        </div>
      </Section>
    </div>
  );
}

function RecordCol({ title, book }: { title: string; book: import("@/lib/types").RecordsBook["career"] }) {
  const league = useLeague((s) => s.league)!;
  return (
    <Panel title={title}>
      <ul className="divide-y divide-border/60">
        {RECORD_CATEGORIES.map((cat) => {
          const r = book[cat];
          const player = r?.playerId ? league.players[r.playerId] : null;
          const team = r?.teamId ? TEAMS_BY_ID[r.teamId] : null;
          return (
            <li key={cat} className="py-2 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted">{RECORD_LABELS[cat]}</span>
                <span className="font-mono text-base font-bold tabular-nums">{r?.value ?? "—"}</span>
              </div>
              {player && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  {team && <TeamLogo team={team} size={14} />}
                  <Link href={`/player/${player.id}`} className="truncate hover:text-accent">
                    {player.firstName} {player.lastName}
                  </Link>
                  {r.year !== undefined && <span>· {r.year}{r.week ? ` Wk${r.week}` : ""}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
