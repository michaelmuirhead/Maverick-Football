"use client";
import { useState } from "react";
import { useLeague } from "@/lib/store/league";
import { GameCard } from "@/components/game-card";
import { Section, Empty } from "@/components/panels";
import { LeagueNav } from "@/components/league-nav";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
  const league = useLeague((s) => s.league);
  const [week, setWeek] = useState<number | null>(null);
  if (!league) return <Empty>No league yet.</Empty>;

  const w = week ?? league.week;
  const allWeeks = Array.from(new Set(league.schedule.filter((g) => g.year === league.year).map((g) => g.week))).sort((a, b) => a - b);
  const games = league.schedule.filter((g) => g.year === league.year && g.week === w);

  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title={`Schedule — ${league.year}`}>
        <div className="scrollbar-thin -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          {allWeeks.map((wk) => (
            <button
              key={wk}
              onClick={() => setWeek(wk)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-xs tap",
                wk === w ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2",
              )}
            >
              {weekLabel(wk)}
            </button>
          ))}
        </div>

        {games.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => <GameCard key={g.id} game={g} accent={league.userTeam ?? undefined} />)}
          </div>
        ) : <Empty>No games this week.</Empty>}
      </Section>
    </div>
  );
}

function weekLabel(w: number) {
  if (w <= 18) return `Wk ${w}`;
  if (w === 19) return "Wild Card";
  if (w === 20) return "Divisional";
  if (w === 21) return "Conf Champ";
  if (w === 22) return "Super Bowl";
  return `Wk ${w}`;
}
