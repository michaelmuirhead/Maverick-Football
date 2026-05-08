"use client";
import Link from "next/link";
import type { Player } from "@/lib/types";
import { cn, gradeColor, tierBadge } from "@/lib/utils";
import { Activity } from "lucide-react";

export function PlayerRow({ player, showTeam = false, rightSlot }: { player: Player; showTeam?: boolean; rightSlot?: React.ReactNode }) {
  const tier = tierBadge(player.ovr);
  const injured = player.injuryWeeks > 0;
  return (
    <Link
      href={`/player/${player.id}`}
      className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 hover:border-border hover:bg-surface2 tap"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface2 font-display text-xs font-bold text-muted">
        {player.position}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{player.firstName} {player.lastName}</span>
          {injured && <Activity size={12} className="shrink-0 text-red-400" />}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>#{player.jersey}</span>
          <span>•</span>
          <span>Age {player.age}</span>
          {showTeam && player.team && <><span>•</span><span>{player.team}</span></>}
        </div>
      </div>
      <span className={cn("hidden rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide sm:inline-block", tier.cls)}>{tier.label}</span>
      <div className="text-right">
        <div className={cn("font-mono text-base font-bold tabular-nums", gradeColor(player.ovr))}>{player.ovr}</div>
        <div className="text-[10px] text-muted">POT {player.pot}</div>
      </div>
      {rightSlot}
    </Link>
  );
}
