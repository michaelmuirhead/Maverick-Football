"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { staffOf } from "@/lib/cpu/coaches";
import type { Coach, CoachRole } from "@/lib/types";
import { Panel } from "./panels";
import { ChevronRight } from "lucide-react";

export function CoachingStaffPreview({ teamId }: { teamId: string }) {
  const league = useLeague((s) => s.league);
  if (!league) return null;
  const { hc, oc, dc } = staffOf(league, teamId);
  if (!hc && !oc && !dc) return null;

  return (
    <Panel
      title="Coaching Staff"
      action={
        <Link href={`/team/${teamId}/coaches`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          Full staff <ChevronRight size={12} />
        </Link>
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <CoachLine coach={hc} role="HC" />
        <CoachLine coach={oc} role="OC" />
        <CoachLine coach={dc} role="DC" />
      </div>
    </Panel>
  );
}

function CoachLine({ coach, role }: { coach: Coach | undefined; role: CoachRole }) {
  if (!coach) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface2/40 px-3 py-2 text-xs text-muted">
        <div className="text-[10px] uppercase tracking-wider opacity-70">{role}</div>
        <div>Vacant</div>
      </div>
    );
  }
  const scheme = role === "HC" ? `${coach.offenseScheme ?? ""} / ${coach.defenseScheme ?? ""}`
                : role === "OC" ? coach.offenseScheme ?? ""
                : coach.defenseScheme ?? "";
  const career = role === "HC" ? `${coach.careerWins}-${coach.careerLosses}` : null;
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-2">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
        <span>{role === "HC" ? "Head Coach" : role === "OC" ? "Off Coordinator" : "Def Coordinator"}</span>
        <span className="text-accent">Rep {coach.reputation}</span>
      </div>
      <div className="mt-0.5 text-sm font-bold leading-tight">{coach.firstName} {coach.lastName}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
        <span>Age {coach.age}</span>
        {scheme && <span>· {scheme}</span>}
        {career && <span>· {career}</span>}
        {coach.championships > 0 && <span className="text-fuchsia-300">· ★{coach.championships}</span>}
        {coach.cotyAwards > 0 && <span className="text-emerald-300">· COY×{coach.cotyAwards}</span>}
      </div>
    </div>
  );
}
