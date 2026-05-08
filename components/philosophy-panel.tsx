"use client";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { Panel } from "./panels";
import { personalityFor } from "@/lib/cpu/personalities";
import { computeTeamPhase } from "@/lib/cpu/strategy";
import { cn } from "@/lib/utils";

export function PhilosophyPanel({ teamId }: { teamId: string }) {
  const league = useLeague((s) => s.league);
  if (!league) return null;
  const team = TEAMS_BY_ID[teamId];
  const personality = personalityFor(teamId);
  const phase = computeTeamPhase(league, teamId);

  return (
    <Panel title="Front Office Identity">
      <div className="space-y-3 text-sm">
        <p className="italic text-muted">"{personality.identity}"</p>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Tag label="Phase" value={phase} tone={phase === "WinNow" ? "win" : phase === "Rebuild" ? "rebuild" : "neutral"} />
          <Tag label="Draft" value={personality.draftStyle} />
          <Tag label="Free Agency" value={personality.faStyle} />
          <Tag label="Off Scheme" value={team.offenseScheme} />
          <Tag label="Def Scheme" value={team.defenseScheme} />
          <Tag label="Tendency" value={personality.rebuildBias} />
        </div>

        <div className="space-y-1.5 pt-1">
          <Bar label="Pass Bias" value={(personality.passBias + 0.18) / 0.36} hint={passLabel(personality.passBias)} />
          <Bar label="4th-Down Aggression" value={personality.fourthDownAggression} hint={aggLabel(personality.fourthDownAggression)} />
          <Bar label="Blitz Rate" value={personality.blitzRate} hint={blitzLabel(personality.blitzRate)} />
          <Bar label="Risk Tolerance" value={personality.riskTolerance} hint={riskLabel(personality.riskTolerance)} />
          <Bar label="Scouting" value={personality.scoutAccuracy} hint={scoutLabel(personality.scoutAccuracy)} />
        </div>
      </div>
    </Panel>
  );
}

function Tag({ label, value, tone }: { label: string; value: string; tone?: "win" | "rebuild" | "neutral" }) {
  const cls = tone === "win" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    : tone === "rebuild" ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
    : "border-border bg-surface2 text-fg";
  return (
    <div className={cn("flex flex-col rounded-md border px-2 py-1", cls)}>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Bar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-[11px] text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
        <div className="h-full bg-accent" style={{ width: `${v * 100}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-[10px] text-muted">{hint}</span>
    </div>
  );
}

function passLabel(b: number) {
  if (b >= 0.08) return "Pass Heavy";
  if (b >= 0.03) return "Pass Lean";
  if (b <= -0.06) return "Run Heavy";
  if (b <= -0.02) return "Run Lean";
  return "Balanced";
}
function aggLabel(a: number) {
  if (a >= 0.7) return "Maniac";
  if (a >= 0.55) return "Aggressive";
  if (a >= 0.4) return "Average";
  return "Conservative";
}
function blitzLabel(b: number) {
  if (b >= 0.65) return "Pressure-Heavy";
  if (b >= 0.55) return "Mixed";
  return "Drop Coverage";
}
function riskLabel(r: number) {
  if (r >= 0.7) return "High Risk";
  if (r >= 0.5) return "Calculated";
  return "Risk Averse";
}
function scoutLabel(s: number) {
  if (s >= 0.82) return "Elite";
  if (s >= 0.72) return "Above Avg";
  if (s >= 0.65) return "Average";
  return "Spotty";
}
