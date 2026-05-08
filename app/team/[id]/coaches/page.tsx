"use client";
import { use } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { TeamNav } from "@/components/team-nav";
import { Empty, Panel, Section } from "@/components/panels";
import { staffOf } from "@/lib/cpu/coaches";
import type { Coach, CoachRole } from "@/lib/types";
import { gradeColor } from "@/lib/utils";

export default function TeamCoachesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const { hc, oc, dc } = staffOf(league, team.id);

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle="Coaching staff" />
      <TeamNav teamId={team.id} />

      <Section title="Coaching Staff">
        <div className="grid gap-3 lg:grid-cols-3">
          <CoachCard coach={hc} role="HC" />
          <CoachCard coach={oc} role="OC" />
          <CoachCard coach={dc} role="DC" />
        </div>
      </Section>

      {hc && (
        <Section title="HC career history">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-surface2 text-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Year</th>
                  <th className="px-2 py-1 text-left">Team</th>
                  <th className="px-2 py-1 text-left">Role</th>
                  <th className="px-2 py-1 text-right">W</th>
                  <th className="px-2 py-1 text-right">L</th>
                  <th className="px-2 py-1 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {hc.history.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-4 text-center text-muted">No prior seasons.</td></tr>
                )}
                {[...hc.history].reverse().map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1 font-mono">{h.year}</td>
                    <td className="px-2 py-1">{TEAMS_BY_ID[h.team]?.abbr ?? h.team}</td>
                    <td className="px-2 py-1 text-muted">{h.role}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.w ?? "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.l ?? "—"}</td>
                    <td className="px-2 py-1 text-[11px]">
                      {h.result ?? ""}{h.coyAward ? " · COY" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function CoachCard({ coach, role }: { coach: Coach | undefined; role: CoachRole }) {
  if (!coach) {
    return <Panel title={role}><Empty>No coach assigned.</Empty></Panel>;
  }
  const roleLabel = role === "HC" ? "Head Coach" : role === "OC" ? "Offensive Coordinator" : "Defensive Coordinator";

  const attrs = coach.attrs;
  const rows: { label: string; v?: number }[] = [
    { label: "Leadership", v: attrs.leadership },
    { label: "Scheme Mastery", v: attrs.scheme },
    { label: "Development", v: attrs.development },
    { label: "Decision Making", v: attrs.decisionMaking },
  ];
  if (role === "OC" || role === "HC") {
    rows.push({ label: "Passing", v: attrs.passing });
    rows.push({ label: "Rushing", v: attrs.rushing });
  }
  if (role === "DC" || role === "HC") {
    rows.push({ label: "Blitz Tendency", v: attrs.blitz });
    rows.push({ label: "Coverage", v: attrs.coverage });
  }

  return (
    <Panel title={roleLabel}>
      <div className="space-y-2">
        <div>
          <div className="font-display text-lg font-bold">{coach.firstName} {coach.lastName}</div>
          <div className="text-[11px] text-muted">
            Age {coach.age} • {coach.yearsExperience} yr experience • Rep {coach.reputation}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 text-[10px]">
          {coach.offenseScheme && <span className="rounded border border-border bg-surface2 px-1.5 py-0.5">Off: {coach.offenseScheme}</span>}
          {coach.defenseScheme && <span className="rounded border border-border bg-surface2 px-1.5 py-0.5">Def: {coach.defenseScheme}</span>}
          {coach.championships > 0 && <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-fuchsia-300">{coach.championships}× Champion</span>}
          {coach.cotyAwards > 0 && <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{coach.cotyAwards}× COY</span>}
        </div>

        <div className="space-y-1.5 pt-1">
          {rows.map((r) => r.v != null ? (
            <div key={r.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-32 truncate text-muted">{r.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                <div className="h-full bg-accent" style={{ width: `${r.v}%` }} />
              </div>
              <span className={`w-7 text-right font-mono ${gradeColor(r.v)}`}>{r.v}</span>
            </div>
          ) : null)}
        </div>

        {role === "HC" && (
          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
            <div className="rounded-md border border-border bg-bg px-2 py-1">
              <div className="text-[10px] text-muted">Career</div>
              <div className="font-mono tabular-nums">{coach.careerWins}-{coach.careerLosses}</div>
            </div>
            <div className="rounded-md border border-border bg-bg px-2 py-1">
              <div className="text-[10px] text-muted">4th-Down Aggression</div>
              <div className="font-mono tabular-nums">{Math.round(coach.fourthDownAgg * 100)}%</div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
