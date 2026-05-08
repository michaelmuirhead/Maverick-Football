import type { Team } from "@/lib/types";
import { TeamLogo } from "./team-logo";

export function TeamBanner({ team, subtitle, action }: { team: Team; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4"
      style={{ background: `linear-gradient(135deg, ${team.primary}55, ${team.secondary}33), rgb(17 20 27)` }}
    >
      <TeamLogo team={team} size={48} />
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg font-bold leading-tight">{team.city} {team.name}</div>
        <div className="truncate text-xs text-muted">{subtitle ?? `${team.stadium} • ${team.offenseScheme} / ${team.defenseScheme}`}</div>
      </div>
      {action}
    </div>
  );
}
