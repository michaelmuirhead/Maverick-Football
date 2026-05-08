"use client";
import { useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Section, Empty, Panel } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";

type StatKey = "passYds" | "passTd" | "rushYds" | "rushTd" | "recYds" | "recTd" | "rec" | "tackles" | "sacks" | "ints";

const CATS: { key: StatKey; label: string; positions: string[] }[] = [
  { key: "passYds", label: "Passing Yards", positions: ["QB"] },
  { key: "passTd",  label: "Passing TDs", positions: ["QB"] },
  { key: "rushYds", label: "Rushing Yards", positions: ["RB","QB"] },
  { key: "rushTd",  label: "Rushing TDs", positions: ["RB","QB","WR"] },
  { key: "recYds",  label: "Receiving Yards", positions: ["WR","TE","RB"] },
  { key: "recTd",   label: "Receiving TDs", positions: ["WR","TE","RB"] },
  { key: "rec",     label: "Receptions", positions: ["WR","TE","RB"] },
  { key: "tackles", label: "Tackles", positions: ["MLB","OLB","SS","FS","CB","LE","RE","DT"] },
  { key: "sacks",   label: "Sacks", positions: ["LE","RE","DT","OLB","MLB"] },
  { key: "ints",    label: "Interceptions", positions: ["CB","FS","SS","MLB","OLB"] },
];

export default function StatsPage() {
  const league = useLeague((s) => s.league);
  const [cat, setCat] = useState<StatKey>("passYds");
  if (!league) return <Empty>No league yet.</Empty>;

  const def = CATS.find((c) => c.key === cat)!;
  const players = Object.values(league.players);
  const rows = players
    .map((p) => {
      const r = p.history.find((h) => h.year === league.year);
      const v = r ? (r as any)[cat] ?? 0 : 0;
      return { p, v };
    })
    .filter(({ p, v }) => v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 25);

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title={`Stats — ${league.year}`}>
        <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)}
              className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
                c.key === cat ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2")}>
              {c.label}
            </button>
          ))}
        </div>

        <Panel title={def.label}>
          <ol className="divide-y divide-border/60">
            {rows.map(({ p, v }, i) => {
              const t = p.team ? TEAMS_BY_ID[p.team] : null;
              return (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-surface2 font-mono text-xs">{i + 1}</span>
                  {t ? <TeamLogo team={t} size={22} /> : <div className="h-[22px] w-[22px]" />}
                  <Link href={`/player/${p.id}`} className="flex-1 truncate text-sm hover:text-accent">{p.firstName} {p.lastName}</Link>
                  <span className="text-[11px] text-muted">{p.position}</span>
                  <span className="font-mono text-base font-bold tabular-nums">{v}</span>
                </li>
              );
            })}
          </ol>
        </Panel>
      </Section>
    </div>
  );
}
