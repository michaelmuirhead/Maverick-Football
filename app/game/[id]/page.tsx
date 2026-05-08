"use client";
import { use } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TeamLogo } from "@/components/team-logo";
import { cn } from "@/lib/utils";
import type { BoxStat } from "@/lib/types";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const game = league.schedule.find((g) => g.id === id);
  if (!game) return <Empty>Game not found.</Empty>;
  const home = TEAMS_BY_ID[game.home];
  const away = TEAMS_BY_ID[game.away];

  if (!game.played || !game.result) {
    return (
      <div className="space-y-4">
        <ScoreBanner home={home} away={away} hs={null} as={null} ot={false} />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-muted">
          <span>Not played yet.</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/game/${game.id}/preview`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-xs font-bold tap hover:bg-surface2"
            >
              View matchup preview
            </Link>
            <Link
              href={`/game/${game.id}/live`}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-bold text-bg tap hover:opacity-90"
            >
              Watch live play-by-play →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const r = game.result;
  return (
    <div className="space-y-4">
      <ScoreBanner home={home} away={away} hs={r.homeScore} as={r.awayScore} ot={r.ot} />
      <div className="text-center text-sm italic text-muted">{r.storyline}</div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Yards" value={`${r.awayYards} / ${r.homeYards}`} hint={`${away.abbr} / ${home.abbr}`} />
        <Stat label="Turnovers" value={`${r.awayTO} / ${r.homeTO}`} hint={`${away.abbr} / ${home.abbr}`} />
        <Stat label="TOP" value={`${formatTime(r.awayTOP)} / ${formatTime(r.homeTOP)}`} />
        <Stat label="Drives" value={r.drives.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BoxPanel title={`${away.city} ${away.name}`} box={r.awayBox} />
        <BoxPanel title={`${home.city} ${home.name}`} box={r.homeBox} />
      </div>

      <Section title="Drive log">
        <ol className="space-y-1">
          {r.drives.map((d, i) => {
            const t = TEAMS_BY_ID[d.team];
            return (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <TeamLogo team={t} size={20} />
                <span className="font-mono text-[10px] text-muted">{d.plays}p · {d.yards}y · {Math.round(d.timeSec/60)}m</span>
                <span className="flex-1">{d.text}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold",
                  d.result === "TD" ? "bg-emerald-500/20 text-emerald-300" :
                  d.result === "FG" ? "bg-cyan-500/20 text-cyan-300" :
                  d.result === "INT" || d.result === "FUM" ? "bg-red-500/20 text-red-300" :
                  "bg-zinc-500/20 text-zinc-300"
                )}>{d.result}</span>
              </li>
            );
          })}
        </ol>
      </Section>
    </div>
  );
}

function ScoreBanner({ home, away, hs, as, ot }: { home: any; away: any; hs: number | null; as: number | null; ot: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="grid grid-cols-3 items-center gap-3">
        <Side team={away} score={as} won={hs !== null && (as ?? 0) > (hs ?? 0)} />
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-muted">{ot ? "FINAL OT" : hs !== null ? "FINAL" : "SCHEDULED"}</div>
        </div>
        <Side team={home} score={hs} won={hs !== null && (hs ?? 0) > (as ?? 0)} home />
      </div>
    </div>
  );
}
function Side({ team, score, won, home }: { team: any; score: number | null; won: boolean; home?: boolean }) {
  return (
    <Link href={`/team/${team.id}`} className={cn("flex items-center gap-3", home ? "flex-row-reverse text-right" : "")}>
      <TeamLogo team={team} size={48} />
      <div className="min-w-0">
        <div className="font-display text-lg font-bold leading-tight">{team.name}</div>
        <div className="text-[11px] text-muted">{team.city}</div>
      </div>
      {score !== null && (
        <span className={cn("font-mono text-3xl font-bold tabular-nums", won ? "text-fg" : "text-muted")}>{score}</span>
      )}
    </Link>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function BoxPanel({ title, box }: { title: string; box: BoxStat[] }) {
  const league = useLeague((s) => s.league)!;
  const lookup = (id: string) => league.players[id];
  const passers = box.filter((b) => (b.passAtt ?? 0) > 0).sort((a, b) => (b.passYds ?? 0) - (a.passYds ?? 0));
  const rushers = box.filter((b) => (b.rushAtt ?? 0) > 0).sort((a, b) => (b.rushYds ?? 0) - (a.rushYds ?? 0)).slice(0, 4);
  const receivers = box.filter((b) => (b.rec ?? 0) > 0).sort((a, b) => (b.recYds ?? 0) - (a.recYds ?? 0)).slice(0, 5);
  const defs = box.filter((b) => (b.tackles ?? 0) > 0 || (b.sacks ?? 0) > 0 || (b.ints ?? 0) > 0)
    .sort((a, b) => ((b.tackles ?? 0) + (b.sacks ?? 0) * 3) - ((a.tackles ?? 0) + (a.sacks ?? 0) * 3)).slice(0, 5);

  return (
    <Panel title={title}>
      <div className="space-y-3">
        {passers.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Passing</div>
            {passers.map((b) => {
              const p = lookup(b.playerId);
              if (!p) return null;
              return (
                <div key={b.playerId} className="flex items-center gap-2 text-xs">
                  <Link href={`/player/${p.id}`} className="flex-1 truncate hover:text-accent">{p.firstName[0]}. {p.lastName}</Link>
                  <span className="font-mono tabular-nums">{b.passCmp}/{b.passAtt} • {b.passYds} yd • {b.passTd ?? 0} TD{b.passInt ? ` • ${b.passInt} INT` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
        {rushers.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Rushing</div>
            {rushers.map((b) => {
              const p = lookup(b.playerId);
              if (!p) return null;
              return (
                <div key={b.playerId} className="flex items-center gap-2 text-xs">
                  <Link href={`/player/${p.id}`} className="flex-1 truncate hover:text-accent">{p.firstName[0]}. {p.lastName}</Link>
                  <span className="font-mono tabular-nums">{b.rushAtt} car • {b.rushYds} yd{b.rushTd ? ` • ${b.rushTd} TD` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
        {receivers.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Receiving</div>
            {receivers.map((b) => {
              const p = lookup(b.playerId);
              if (!p) return null;
              return (
                <div key={b.playerId} className="flex items-center gap-2 text-xs">
                  <Link href={`/player/${p.id}`} className="flex-1 truncate hover:text-accent">{p.firstName[0]}. {p.lastName}</Link>
                  <span className="font-mono tabular-nums">{b.rec} rec • {b.recYds} yd{b.recTd ? ` • ${b.recTd} TD` : ""}</span>
                </div>
              );
            })}
          </div>
        )}
        {defs.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Defense</div>
            {defs.map((b) => {
              const p = lookup(b.playerId);
              if (!p) return null;
              return (
                <div key={b.playerId} className="flex items-center gap-2 text-xs">
                  <Link href={`/player/${p.id}`} className="flex-1 truncate hover:text-accent">{p.firstName[0]}. {p.lastName}</Link>
                  <span className="font-mono tabular-nums">
                    {b.tackles ? `${b.tackles} tkl ` : ""}
                    {b.sacks ? `• ${b.sacks} sck ` : ""}
                    {b.ints ? `• ${b.ints} INT` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
