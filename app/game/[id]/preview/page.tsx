"use client";
import { use } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { teamSimRatings, teamOvr, getRoster } from "@/lib/gen/roster";
import { staffOf } from "@/lib/cpu/coaches";
import { headToHead, rivalryLine } from "@/lib/cpu/franchise";
import { describeWeather, weatherEmoji, hfaBoost } from "@/lib/cpu/weather";
import { gradeColor, cn } from "@/lib/utils";
import { Tv, Clipboard, ChevronRight, Zap, Shield, Crosshair } from "lucide-react";
import type { Position } from "@/lib/types";

export default function GamePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const game = league.schedule.find((g) => g.id === id);
  if (!game) return <Empty>Game not found.</Empty>;

  if (game.played) {
    return (
      <div className="space-y-3">
        <Empty>This game has already been played.</Empty>
        <Link href={`/game/${game.id}`} className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-bold text-bg">
          View box score <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  const home = TEAMS_BY_ID[game.home];
  const away = TEAMS_BY_ID[game.away];
  const homeOvr = teamOvr(league, home.id);
  const awayOvr = teamOvr(league, away.id);
  const hr = teamSimRatings(league, home.id);
  const ar = teamSimRatings(league, away.id);
  const homeStaff = staffOf(league, home.id);
  const awayStaff = staffOf(league, away.id);
  const h2h = headToHead(league, home.id, away.id);
  const homeStanding = league.standings[home.id];
  const awayStanding = league.standings[away.id];
  const homeHfa = hfaBoost(home);

  // Rough betting line — home favored by (home OVR - away OVR)/2 + HFA
  const line = Math.round((homeOvr - awayOvr) * 0.4 + homeHfa);
  const favoriteId = line > 0 ? home.id : line < 0 ? away.id : null;
  const lineDisplay = line === 0 ? "PICK 'EM" : favoriteId === home.id ? `${home.abbr} -${Math.abs(line)}` : `${away.abbr} -${Math.abs(line)}`;

  // X-factors — best skill player on each side
  const homeRoster = getRoster(league, home.id).filter((p) => !p.injury && !p.onIR);
  const awayRoster = getRoster(league, away.id).filter((p) => !p.injury && !p.onIR);
  const homeXFactor = homeRoster.find((p) => ["WR", "RB", "TE", "QB"].includes(p.position) && p.depth === "Starter") ?? homeRoster[0];
  const awayXFactor = awayRoster.find((p) => ["WR", "RB", "TE", "QB"].includes(p.position) && p.depth === "Starter") ?? awayRoster[0];

  // Keys to the game — 3 short bullets
  const keys: string[] = [];
  if (Math.abs(homeOvr - awayOvr) >= 6) keys.push(`${homeOvr > awayOvr ? home.abbr : away.abbr} has a clear talent edge — discipline wins it.`);
  else keys.push(`Talent close (${awayOvr} vs ${homeOvr}) — coaching and matchups decide it.`);
  const homePass = hr.qb + hr.wr;
  const homeRun = hr.rb + hr.ol;
  const awayPass = ar.qb + ar.wr;
  const awayRun = ar.rb + ar.ol;
  keys.push(homePass > awayPass ? `${home.abbr}'s pass game is the engine — get the ball to the WR room.` : `${away.abbr}'s pass game is the engine — get the ball to the WR room.`);
  keys.push(homeRun > awayRun ? `${home.abbr}'s ground game can drain the clock and shorten the game.` : `${away.abbr}'s ground game can drain the clock and shorten the game.`);

  // Injury concerns
  const homeKey = homeRoster.filter((p) => p.injury && p.depth !== "Reserve").slice(0, 3);
  const awayKey = awayRoster.filter((p) => p.injury && p.depth !== "Reserve").slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-3 items-center gap-3">
          <Side team={away} ovr={awayOvr} record={`${awayStanding.w}-${awayStanding.l}`} />
          <div className="text-center">
            <div className="font-mono text-xs uppercase tracking-wider text-muted">PREGAME</div>
            <div className="mt-1 font-display text-2xl font-bold">vs</div>
            <div className="mt-1 text-[11px] text-muted">{game.playoffRound ?? `Wk ${game.week}`} • {league.year}</div>
            <div className="mt-1 text-[11px] text-accent">{lineDisplay}</div>
          </div>
          <Side team={home} ovr={homeOvr} record={`${homeStanding.w}-${homeStanding.l}`} home />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
          <span title={describeWeather(game.weather)}>{weatherEmoji(game.weather?.condition)} {describeWeather(game.weather)}</span>
          <span>•</span>
          <span>{home.stadium}</span>
          {homeHfa > 0 && <><span>•</span><span>+{homeHfa.toFixed(1)} HFA</span></>}
          <span>•</span>
          <span>{rivalryLine(h2h)}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {league.userTeam && (game.home === league.userTeam || game.away === league.userTeam) && (
          <Link
            href={`/game/${game.id}/plan`}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold tap hover:bg-surface2"
          >
            <Clipboard size={14} /> Set game plan
          </Link>
        )}
        <Link
          href={`/game/${game.id}/live`}
          className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent tap hover:bg-accent/20"
        >
          <Tv size={14} /> Watch live play-by-play
        </Link>
      </div>

      {/* Keys to the game */}
      <Panel title="Keys to the game">
        <ul className="space-y-2">
          {keys.map((k, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Crosshair size={14} className="mt-0.5 shrink-0 text-accent" />
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Matchup */}
      <Section title="Matchup ratings">
        <div className="grid gap-2 lg:grid-cols-2">
          <Panel title={`${away.abbr} attack vs ${home.abbr} defense`}>
            <MatchupBar label="Pass" away={ar.qb + ar.wr} home={hr.db + hr.lb} />
            <MatchupBar label="Run" away={ar.rb + ar.ol} home={hr.dl + hr.lb} />
          </Panel>
          <Panel title={`${home.abbr} attack vs ${away.abbr} defense`}>
            <MatchupBar label="Pass" away={hr.qb + hr.wr} home={ar.db + ar.lb} />
            <MatchupBar label="Run" away={hr.rb + hr.ol} home={ar.dl + ar.lb} />
          </Panel>
        </div>
      </Section>

      {/* X-factors */}
      <Section title="X-factors">
        <div className="grid gap-2 sm:grid-cols-2">
          <XFactorCard team={away} player={awayXFactor} />
          <XFactorCard team={home} player={homeXFactor} />
        </div>
      </Section>

      {/* Coaching matchup */}
      <Section title="Coaching staff">
        <div className="grid gap-2 sm:grid-cols-2">
          <Panel title={`${away.abbr} staff`}>
            <StaffLine label="HC" coach={awayStaff.hc} />
            <StaffLine label="OC" coach={awayStaff.oc} />
            <StaffLine label="DC" coach={awayStaff.dc} />
          </Panel>
          <Panel title={`${home.abbr} staff`}>
            <StaffLine label="HC" coach={homeStaff.hc} />
            <StaffLine label="OC" coach={homeStaff.oc} />
            <StaffLine label="DC" coach={homeStaff.dc} />
          </Panel>
        </div>
      </Section>

      {/* Injuries */}
      {(homeKey.length > 0 || awayKey.length > 0) && (
        <Section title="Injury concerns">
          <div className="grid gap-2 sm:grid-cols-2">
            <InjuryList team={away} list={awayKey} />
            <InjuryList team={home} list={homeKey} />
          </div>
        </Section>
      )}
    </div>
  );
}

function Side({ team, ovr, record, home }: { team: typeof TEAMS_BY_ID[string]; ovr: number; record: string; home?: boolean }) {
  return (
    <Link href={`/team/${team.id}`} className={cn("flex items-center gap-3 hover:opacity-90", home && "flex-row-reverse text-right")}>
      <TeamLogo team={team} size={48} />
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold leading-tight">{team.name}</div>
        <div className="text-[11px] text-muted">{team.city} • {record} • <span className={gradeColor(ovr)}>{ovr}</span></div>
      </div>
    </Link>
  );
}

function MatchupBar({ label, away, home }: { label: string; away: number; home: number }) {
  const total = away + home;
  const awayPct = total > 0 ? (away / total) * 100 : 50;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="font-mono">{Math.round(away)} vs {Math.round(home)}</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-bg">
        <div style={{ width: `${awayPct}%` }} className="bg-orange-400" />
        <div style={{ width: `${100 - awayPct}%` }} className="bg-blue-400" />
      </div>
    </div>
  );
}

function XFactorCard({ team, player }: { team: typeof TEAMS_BY_ID[string]; player: import("@/lib/types").Player | undefined }) {
  if (!player) return null;
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <TeamLogo team={team} size={28} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted">{team.abbr} X-factor</div>
          <Link href={`/player/${player.id}`} className="block truncate font-display text-base font-bold hover:text-accent">
            {player.firstName} {player.lastName}
          </Link>
          <div className="text-[11px] text-muted">{player.position} · #{player.jersey}</div>
        </div>
        <div className={cn("font-mono text-xl font-bold", gradeColor(player.ovr))}>{player.ovr}</div>
      </div>
    </Panel>
  );
}

function StaffLine({ label, coach }: { label: string; coach?: import("@/lib/types").Coach }) {
  if (!coach) return <div className="text-xs text-muted">{label}: vacant</div>;
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="font-mono text-[10px] text-muted">{label}</span>
      <span className="flex-1 truncate px-2">{coach.firstName} {coach.lastName}</span>
      <span className="text-muted">Rep {coach.reputation}</span>
    </div>
  );
}

function InjuryList({ team, list }: { team: typeof TEAMS_BY_ID[string]; list: import("@/lib/types").Player[] }) {
  if (list.length === 0) {
    return (
      <Panel title={`${team.abbr}`}>
        <div className="text-xs text-muted">No major injury concerns.</div>
      </Panel>
    );
  }
  return (
    <Panel title={`${team.abbr}`}>
      <ul className="space-y-1">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{p.position}</span>
            <Link href={`/player/${p.id}`} className="flex-1 truncate hover:text-accent">{p.firstName} {p.lastName}</Link>
            <span className="text-red-300">{p.injury?.type ?? "INJ"} · {p.injury?.weeks ?? p.injuryWeeks}w</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
