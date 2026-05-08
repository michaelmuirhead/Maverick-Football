"use client";
import { use } from "react";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { Empty, Section } from "@/components/panels";
import { TeamNav } from "@/components/team-nav";
import { GameCard } from "@/components/game-card";

export default function TeamSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const games = league.schedule
    .filter((g) => g.year === league.year && (g.home === team.id || g.away === team.id))
    .sort((a, b) => a.week - b.week);

  return (
    <div className="space-y-4">
      <TeamBanner team={team} />
      <TeamNav teamId={team.id} />
      <Section title={`${league.year} schedule`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => <GameCard key={g.id} game={g} accent={team.id} />)}
        </div>
      </Section>
    </div>
  );
}
