import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

export function TeamLogo({ team, size = 28, className }: { team: Team; size?: number; className?: string }) {
  return (
    <div
      className={cn("relative grid place-items-center rounded-md font-display font-bold text-white shadow-sm", className)}
      style={{
        width: size,
        height: size,
        background: team.primary,
        boxShadow: `inset 0 0 0 1.5px ${team.secondary}`,
        fontSize: Math.round(size * 0.42),
      }}
      title={`${team.city} ${team.name}`}
    >
      <span className="leading-none">{team.abbr}</span>
    </div>
  );
}
