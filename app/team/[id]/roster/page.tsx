"use client";
import { use, useState } from "react";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { Empty, Section } from "@/components/panels";
import { TeamNav } from "@/components/team-nav";
import { PlayerRow } from "@/components/player-row";
import { getRoster } from "@/lib/gen/roster";
import { GROUP_LABEL, GROUP_ORDER, POSITION_GROUP } from "@/lib/data/positions";
import { cn } from "@/lib/utils";

export default function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  const [filter, setFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<"ovr" | "age" | "aav">("ovr");

  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const roster = getRoster(league, team.id);
  const filtered = filter === "ALL" ? roster : roster.filter((p) => POSITION_GROUP[p.position] === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "age") return a.age - b.age;
    if (sort === "aav") return (b.contract?.aav ?? 0) - (a.contract?.aav ?? 0);
    return b.ovr - a.ovr;
  });

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle={`${roster.length} players`} />
      <TeamNav teamId={team.id} />

      <Section title="Roster">
        <div className="flex flex-wrap items-center gap-2">
          <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {(["ALL", ...GROUP_ORDER] as const).map((g) => (
              <button key={g} onClick={() => setFilter(g)}
                className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
                  filter === g ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2")}>
                {g === "ALL" ? "All" : GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-muted">Sort:</span>
            {(["ovr","age","aav"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)}
                className={cn("rounded-md border px-2 py-1 text-xs tap",
                  sort === s ? "border-accent text-accent" : "border-border text-muted hover:text-fg")}>
                {s === "ovr" ? "OVR" : s === "age" ? "Age" : "$AAV"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1 sm:grid-cols-2">
          {sorted.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              rightSlot={
                p.contract && (
                  <div className="hidden text-right sm:block">
                    <div className="font-mono text-xs text-muted">${p.contract.aav.toFixed(1)}M</div>
                    <div className="text-[10px] text-muted">{p.contract.years}yr</div>
                  </div>
                )
              }
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
