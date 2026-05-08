"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor } from "@/lib/utils";
import { ChevronRight, Loader2 } from "lucide-react";
import { useMemo } from "react";

export default function OffseasonPage() {
  const league = useLeague((s) => s.league);
  const advance = useLeague((s) => s.advanceOffseason);
  const busy = useLeague((s) => s.busy);

  const champion = useMemo(() => {
    if (!league) return null;
    const lastChamp = league.champions[league.champions.length - 1];
    if (!lastChamp) return null;
    return { team: TEAMS_BY_ID[lastChamp.team], runnerUp: TEAMS_BY_ID[lastChamp.runnerUp], year: lastChamp.year };
  }, [league]);

  if (!league) return <Empty>No league yet.</Empty>;
  if (!league.phase.startsWith("Offseason")) {
    return (
      <Empty>
        Currently in {league.phase}. Sim to end of season to manage the offseason.
      </Empty>
    );
  }

  const yearAwards = league.awards.filter((a) => a.year === league.year);
  const mvp = yearAwards.find((a) => a.type === "MVP");
  const opoy = yearAwards.find((a) => a.type === "OPOY");
  const dpoy = yearAwards.find((a) => a.type === "DPOY");
  const oroy = yearAwards.find((a) => a.type === "OROY");
  const droy = yearAwards.find((a) => a.type === "DROY");

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-border bg-surface p-4">
        <h1 className="font-display text-2xl font-bold">{league.year} Offseason</h1>
        <p className="mt-1 text-sm text-muted">Run the full offseason in one click — retirements, progression, free agency, and the draft.</p>
        <button
          onClick={() => advance()}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-bg tap hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
          Run Full Offseason → start {league.year + 1}
        </button>
      </header>

      {champion && (
        <Panel title={`Super Bowl ${champion.year} Champions`}>
          <div className="flex items-center gap-4">
            <TeamLogo team={champion.team} size={48} />
            <div className="flex-1">
              <div className="font-display text-xl font-bold">{champion.team.city} {champion.team.name}</div>
              <div className="text-xs text-muted">defeated {champion.runnerUp.city} {champion.runnerUp.name}</div>
            </div>
          </div>
        </Panel>
      )}

      <Section title={`${league.year} Awards`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AwardCard label="MVP" award={mvp} league={league} />
          <AwardCard label="OPOY" award={opoy} league={league} />
          <AwardCard label="DPOY" award={dpoy} league={league} />
          <AwardCard label="OROY" award={oroy} league={league} />
          <AwardCard label="DROY" award={droy} league={league} />
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/offseason/free-agency" className="rounded-lg border border-border bg-surface p-4 hover:border-accent/40 hover:bg-surface2 tap">
          <div className="text-xs uppercase tracking-wider text-muted">Free Agency</div>
          <div className="font-display text-xl font-bold">{league.freeAgents.length} available</div>
          <div className="mt-1 text-xs text-muted">Sign free agents to fill gaps on your roster</div>
        </Link>
        <Link href="/offseason/draft" className="rounded-lg border border-border bg-surface p-4 hover:border-accent/40 hover:bg-surface2 tap">
          <div className="text-xs uppercase tracking-wider text-muted">Draft Class</div>
          <div className="font-display text-xl font-bold">{league.draftClass.length} prospects</div>
          <div className="mt-1 text-xs text-muted">Scout the upcoming class — your picks await</div>
        </Link>
      </div>
    </div>
  );
}

function AwardCard({ label, award, league }: { label: string; award: any; league: any }) {
  if (!award) return <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted">No {label} yet</div>;
  const player = league.players[award.playerId];
  if (!player) return null;
  const team = TEAMS_BY_ID[award.team];
  return (
    <Link href={`/player/${player.id}`} className="rounded-md border border-border bg-surface p-3 hover:border-accent/40 tap">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">{label}</span>
        <TeamLogo team={team} size={20} />
      </div>
      <div className="mt-2 text-sm font-bold">{player.firstName} {player.lastName}</div>
      <div className="text-[11px] text-muted">{player.position} • {team.abbr}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${gradeColor(player.ovr)}`}>{player.ovr}</div>
    </Link>
  );
}
