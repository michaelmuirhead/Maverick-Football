"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { LeagueNav } from "@/components/league-nav";
import { Section, Empty, Panel } from "@/components/panels";
import { GameCard } from "@/components/game-card";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { computePlayoffSeeds } from "@/lib/sim/season";

export default function PlayoffsPage() {
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;

  const playoffGames = league.schedule
    .filter((g) => g.year === league.year && (g.playoffRound != null))
    .sort((a, b) => a.week - b.week);

  const afcSeeds = computePlayoffSeeds(league, "AFC");
  const nfcSeeds = computePlayoffSeeds(league, "NFC");

  const byRound = (round: string) => playoffGames.filter((g) => g.playoffRound === round);

  return (
    <div className="space-y-4">
      <LeagueNav />

      <Section title={`Playoff Picture — ${league.year}`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="AFC seeds">
            <ul className="divide-y divide-border/60">
              {afcSeeds.map((s, i) => <SeedRow key={s.team} row={s} idx={i + 1} />)}
            </ul>
          </Panel>
          <Panel title="NFC seeds">
            <ul className="divide-y divide-border/60">
              {nfcSeeds.map((s, i) => <SeedRow key={s.team} row={s} idx={i + 1} />)}
            </ul>
          </Panel>
        </div>
      </Section>

      {playoffGames.length > 0 && (
        <div className="space-y-4">
          {(["WC","DIV","CONF","SB"] as const).map((r) => {
            const list = byRound(r);
            if (!list.length) return null;
            return (
              <Section key={r} title={roundLabel(r)}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {list.map((g) => <GameCard key={g.id} game={g} accent={league.userTeam ?? undefined} />)}
                </div>
              </Section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeedRow({ row, idx }: { row: any; idx: number }) {
  const t = TEAMS_BY_ID[row.team];
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-surface2 font-mono text-xs font-bold">{idx}</span>
      <TeamLogo team={t} size={22} />
      <Link href={`/team/${t.id}`} className="flex-1 truncate text-sm hover:text-accent">{t.city} {t.name}</Link>
      <span className="font-mono text-xs text-muted">{row.w}-{row.l}{row.t > 0 ? `-${row.t}` : ""}</span>
    </li>
  );
}
function roundLabel(r: string) {
  return r === "WC" ? "Wild Card" : r === "DIV" ? "Divisional" : r === "CONF" ? "Conference Championship" : "Super Bowl";
}
