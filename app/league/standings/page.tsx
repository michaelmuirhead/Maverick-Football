"use client";
import { useLeague } from "@/lib/store/league";
import { StandingsTable } from "@/components/standings-table";
import { Section, Empty } from "@/components/panels";
import { LeagueNav } from "@/components/league-nav";

export default function StandingsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  return (
    <div className="space-y-4">
      <LeagueNav />
      <Section title={`Standings — ${league.year}`}>
        <StandingsTable league={league} />
      </Section>
    </div>
  );
}
