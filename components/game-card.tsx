"use client";
import Link from "next/link";
import type { Game } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "./team-logo";
import { cn } from "@/lib/utils";
import { Tv } from "lucide-react";
import { weatherEmoji, describeWeather } from "@/lib/cpu/weather";
import { useLeague } from "@/lib/store/league";
import { headToHead, rivalryLine } from "@/lib/cpu/franchise";

export function GameCard({ game, accent }: { game: Game; accent?: string }) {
  const league = useLeague((s) => s.league);
  const home = TEAMS_BY_ID[game.home];
  const away = TEAMS_BY_ID[game.away];
  const r = game.result;

  const homeWon = r ? r.homeScore > r.awayScore : false;
  const awayWon = r ? r.awayScore > r.homeScore : false;

  const h2h = league ? headToHead(league, game.home, game.away) : null;
  const showRivalry = h2h && (h2h.aWins + h2h.bWins + h2h.ties) >= 1;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-surface p-3 transition hover:border-accent/40 hover:bg-surface2",
        accent && game.home === accent && "ring-1 ring-accent/30",
        accent && game.away === accent && "ring-1 ring-accent/30",
      )}
    >
      <Link href={`/game/${game.id}`} className="block tap">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <Side team={away} score={r?.awayScore} won={awayWon} played={game.played} />
            <Side team={home} score={r?.homeScore} won={homeWon} played={game.played} home />
          </div>
          <div className="text-right text-[11px] text-muted">
            {game.played ? (
              <>
                <div>FINAL{r?.ot ? " / OT" : ""}</div>
                <div>{game.playoffRound ?? `Wk ${game.week}`}</div>
              </>
            ) : (
              <>
                <div>SCHEDULED</div>
                <div>{game.playoffRound ?? `Wk ${game.week}`}</div>
              </>
            )}
            {game.weather && (
              <div className="mt-0.5" title={describeWeather(game.weather)}>{weatherEmoji(game.weather.condition)}</div>
            )}
          </div>
        </div>
        {r && (
          <div className="mt-2 line-clamp-1 text-[11px] text-muted">{r.storyline}</div>
        )}
        {showRivalry && h2h && (
          <div className="mt-1 line-clamp-1 text-[10px] text-muted/80">{rivalryLine(h2h)}</div>
        )}
      </Link>
      {!game.played && (
        <Link
          href={`/game/${game.id}/live`}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/20 tap"
          onClick={(e) => e.stopPropagation()}
        >
          <Tv size={11} /> Watch
        </Link>
      )}
    </div>
  );
}

function Side({ team, score, won, played, home }: { team: typeof TEAMS_BY_ID[string]; score?: number; won?: boolean; played: boolean; home?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", played && !won && "text-muted")}>
      <TeamLogo team={team} size={22} />
      <span className="text-[11px] uppercase text-muted">{home ? "vs" : "@"}</span>
      <span className="flex-1 truncate text-sm font-medium">{team.name}</span>
      {played && (
        <span className={cn("font-mono text-sm tabular-nums", won && "font-bold text-fg")}>{score}</span>
      )}
    </div>
  );
}
