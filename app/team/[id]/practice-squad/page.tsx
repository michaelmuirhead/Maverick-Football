"use client";
import { use } from "react";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { TeamNav } from "@/components/team-nav";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { PlayerRow } from "@/components/player-row";
import { listPracticeSquad, PS_LIMIT } from "@/lib/cpu/practiceSquad";
import { getRoster } from "@/lib/gen/roster";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function PracticeSquadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  const toPS = useLeague((s) => s.toPracticeSquad);
  const fromPS = useLeague((s) => s.fromPracticeSquad);
  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;
  const isUser = league.userTeam === team.id;

  const ps = listPracticeSquad(league, team.id);
  const roster = getRoster(league, team.id).filter((p) => !p.onPracticeSquad && !p.injury);
  const psEligible = roster.filter((p) => p.depth !== "Starter" && p.ovr <= 78);

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle="Practice squad" />
      <TeamNav teamId={team.id} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="On practice squad" value={`${ps.length} / ${PS_LIMIT}`} />
        <Stat label="Slots open" value={Math.max(0, PS_LIMIT - ps.length)} />
        <Stat label="Eligible to demote" value={psEligible.length} />
      </div>

      <Section title="Practice Squad">
        {ps.length === 0 ? <Empty>No players on practice squad.</Empty> : (
          <div className="grid gap-1 sm:grid-cols-2">
            {ps.map((p) => (
              <PlayerRow
                key={p.id}
                player={p}
                rightSlot={isUser ? (
                  <button
                    onClick={() => fromPS(p.id)}
                    className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] hover:bg-surface2"
                  >
                    <ArrowUp size={10} /> Promote
                  </button>
                ) : null}
              />
            ))}
          </div>
        )}
      </Section>

      {isUser && ps.length < PS_LIMIT && (
        <Section title="Eligible to send to PS">
          <Panel>
            <div className="grid gap-1 sm:grid-cols-2">
              {psEligible.slice(0, 30).map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  rightSlot={
                    <button
                      onClick={() => toPS(p.id)}
                      className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] hover:bg-surface2"
                    >
                      <ArrowDown size={10} /> Demote
                    </button>
                  }
                />
              ))}
            </div>
          </Panel>
        </Section>
      )}
    </div>
  );
}
