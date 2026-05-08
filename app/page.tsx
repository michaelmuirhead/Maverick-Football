"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS, TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { TeamBanner } from "@/components/team-banner";
import { Panel, Stat, Section, Empty } from "@/components/panels";
import { GameCard } from "@/components/game-card";
import { SimWeekButton, SimSeasonButton, SimToUserGameButton } from "@/components/sim-button";
import { teamOvr, getRoster } from "@/lib/gen/roster";
import { sortStandingsTeams, computePlayoffSeeds } from "@/lib/sim/season";
import { Newspaper, ChevronRight, Tv, Clipboard, Briefcase, ArrowLeftRight, ListTree } from "lucide-react";

export default function Home() {
  const league = useLeague((s) => s.league);
  const hydrated = useLeague((s) => s.hydrated);

  if (!hydrated) {
    return <div className="grid h-[60dvh] place-items-center text-muted">Loading…</div>;
  }
  if (!league) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">Maverick Football</h1>
          <p className="mt-2 text-sm text-muted">An immersive NFL franchise simulator. Build a dynasty.</p>
          <Link href="/new-game" className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-bg tap hover:opacity-90">
            Start a new league <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const userTeam = league.userTeam ? TEAMS_BY_ID[league.userTeam] : null;
  const upcomingUserGames = league.schedule
    .filter((g) => g.year === league.year && !g.played && (g.home === league.userTeam || g.away === league.userTeam))
    .sort((a, b) => a.week - b.week)
    .slice(0, 1);
  const recentUserGames = league.schedule
    .filter((g) => g.year === league.year && g.played && (g.home === league.userTeam || g.away === league.userTeam))
    .sort((a, b) => b.week - a.week)
    .slice(0, 2);
  const news = league.news.slice(0, 6);
  const standings = userTeam
    ? sortStandingsTeams(TEAMS.filter((t) => t.conference === userTeam.conference && t.division === userTeam.division)
        .map((t) => league.standings[t.id]))
    : [];

  const userOvr = userTeam ? teamOvr(league, userTeam.id) : 0;
  const roster = userTeam ? getRoster(league, userTeam.id) : [];
  const stars = roster.filter((p) => p.ovr >= 85).length;
  const injured = roster.filter((p) => p.injuryWeeks > 0).length;

  const isPlayoffs = league.phase === "Playoffs";
  const isOffseason = league.phase.startsWith("Offseason");
  const playoffSeeds = isPlayoffs && userTeam
    ? computePlayoffSeeds(league, userTeam.conference)
    : [];

  return (
    <div className="space-y-6">
      {userTeam && (
        <TeamBanner
          team={userTeam}
          subtitle={`Team OVR ${userOvr} • ${stars} stars • ${injured} injured`}
          action={
            <div className="hidden flex-col gap-2 sm:flex">
              <SimToUserGameButton />
              <SimSeasonButton />
            </div>
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SimWeekButton />
        <SimToUserGameButton className="sm:hidden" />
        <SimSeasonButton className="sm:hidden" />
        {isOffseason && (
          <Link href="/offseason" className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent tap hover:bg-accent/20">
            Manage Offseason →
          </Link>
        )}
      </div>

      <Section title="Front Office" action={<Link href="/front-office" className="text-xs text-muted hover:text-fg flex items-center gap-1">Open hub <ChevronRight size={12} /></Link>}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/front-office" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent/40 hover:bg-surface2 tap">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 text-accent"><Briefcase size={16} /></span>
            <div className="flex-1">
              <div className="text-sm font-medium">Front Office Hub</div>
              <div className="text-[11px] text-muted">FA · draft · scouting · trades</div>
            </div>
          </Link>
          <Link href="/trade-center" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent/40 hover:bg-surface2 tap">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 text-accent"><ArrowLeftRight size={16} /></span>
            <div className="flex-1">
              <div className="text-sm font-medium">Trade Center</div>
              <div className="text-[11px] text-muted">Offers · build a trade · league log</div>
            </div>
          </Link>
          <Link href="/offseason/free-agency" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent/40 hover:bg-surface2 tap">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 text-accent"><ListTree size={16} /></span>
            <div className="flex-1">
              <div className="text-sm font-medium">Free Agency</div>
              <div className="text-[11px] text-muted">Browse the FA market</div>
            </div>
          </Link>
          <Link href="/offseason/draft" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent/40 hover:bg-surface2 tap">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-surface2 text-accent"><ListTree size={16} /></span>
            <div className="flex-1">
              <div className="text-sm font-medium">Draft Board</div>
              <div className="text-[11px] text-muted">Prospects · combine · scout</div>
            </div>
          </Link>
        </div>
      </Section>

      <Section title="Upcoming">
        {upcomingUserGames.length ? (
          <div className="space-y-2">
            {upcomingUserGames.map((g) => (
              <div key={g.id} className="space-y-2">
                <GameCard game={g} accent={league.userTeam ?? undefined} />
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/game/${g.id}/plan`}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold tap hover:bg-surface2"
                  >
                    <Clipboard size={14} /> Set game plan
                  </Link>
                  <Link
                    href={`/game/${g.id}/live`}
                    className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent tap hover:bg-accent/20"
                  >
                    <Tv size={14} /> Watch live play-by-play
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>No more games this season.</Empty>}
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Recent" className="lg:col-span-2">
          {recentUserGames.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {recentUserGames.map((g) => <GameCard key={g.id} game={g} accent={league.userTeam ?? undefined} />)}
            </div>
          ) : <Empty>No games played yet.</Empty>}
        </Section>

        <Panel title="Division" action={<Link href="/league/standings" className="text-xs text-muted hover:text-fg">Full standings →</Link>}>
          <ul className="divide-y divide-border/60">
            {standings.map((r) => {
              const t = TEAMS_BY_ID[r.team];
              return (
                <li key={r.team}>
                  <Link href={`/team/${t.id}`} className="flex items-center gap-3 py-2 hover:bg-surface2 tap rounded-md px-1">
                    <TeamLogo team={t} size={24} />
                    <div className="flex-1 truncate text-sm">{t.name}</div>
                    <div className="font-mono text-xs tabular-nums text-muted">{r.w}-{r.l}{r.t > 0 ? `-${r.t}` : ""}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {isPlayoffs && (
        <Section title="Playoff picture" action={<Link href="/league/playoffs" className="text-xs text-muted hover:text-fg">Bracket →</Link>}>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-7">
            {playoffSeeds.map((s) => {
              const t = TEAMS_BY_ID[s.team];
              return (
                <Link key={s.team} href={`/team/${t.id}`} className="flex items-center gap-2 rounded-md border border-border bg-surface p-2 tap hover:bg-surface2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-bg font-display text-xs font-bold">{s.seed}</span>
                  <TeamLogo team={t} size={20} />
                  <span className="truncate text-xs">{t.name}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Headlines" action={<Link href="/news" className="text-xs text-muted hover:text-fg flex items-center gap-1"><Newspaper size={12} /> All news</Link>}>
        <ul className="space-y-2">
          {news.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
              <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-surface2 text-[10px] font-bold uppercase text-muted">
                {newsBadge(n.category)}
              </span>
              <div className="flex-1">
                <div className="text-sm">{n.headline}</div>
                {n.body && <div className="text-xs text-muted">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">
                  {n.year}{n.week > 0 ? ` • Wk ${n.week}` : " • Offseason"}
                </div>
              </div>
              {n.teamId && <TeamLogo team={TEAMS_BY_ID[n.teamId]} size={20} />}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function newsBadge(c: string) {
  if (c === "Game") return "GM";
  if (c === "Trade") return "TR";
  if (c === "FA") return "FA";
  if (c === "Draft") return "DR";
  if (c === "Award") return "AW";
  if (c === "Retire") return "RT";
  if (c === "League") return "LG";
  return "•";
}
