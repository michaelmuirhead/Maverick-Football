"use client";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { gradeColor, cn } from "@/lib/utils";
import { Crown, Briefcase, Headphones, AlertTriangle, ChevronRight, Coffee, Flag } from "lucide-react";
import type { UserCareerStint } from "@/lib/types";

export default function CareerPage() {
  const league = useLeague((s) => s.league);
  const accept = useLeague((s) => s.acceptJobOffer);
  const yearOff = useLeague((s) => s.takeYearOff);
  const retire = useLeague((s) => s.retireFromCareer);

  if (!league) return <Empty>No league yet.</Empty>;
  const career = league.userCareer;
  if (!career) return <Empty>No career data.</Empty>;

  const Icon = career.mode === "Owner" ? Crown : career.mode === "GM" ? Briefcase : Headphones;
  const team = career.team ? TEAMS_BY_ID[career.team] : null;
  const isOwner = career.mode === "Owner";
  const offers = league.jobOffers;

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4"
        style={team ? { background: `linear-gradient(135deg, ${team.primary}55, ${team.secondary}33), rgb(17 20 27)` } : undefined}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-md bg-accent/10 text-accent">
            <Icon size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-bold leading-tight">
              {career.mode}
              {team && <span className="ml-2 text-base font-normal text-muted">— {team.city} {team.name}</span>}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {statusLabel(career.status)}
              {career.hotSeatReason && <span> · {career.hotSeatReason}</span>}
            </div>
          </div>
          {!isOwner && career.team && (
            <div className="text-right">
              <div className={`font-mono text-2xl font-bold ${gradeColor(career.reputation)}`}>{career.reputation}</div>
              <div className="text-[10px] text-muted">REPUTATION</div>
            </div>
          )}
        </div>

        {career.status === "OnHotSeat" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle size={14} />
            <span>You're on the hot seat. Win this year or expect to be let go.</span>
          </div>
        )}
        {career.status === "Fired" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle size={14} />
            <span>You've been let go. Choose your next move below.</span>
          </div>
        )}
        {career.status === "TakingYearOff" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
            <Coffee size={14} />
            <span>Taking the year off. New offers will arrive after the next offseason.</span>
          </div>
        )}
        {career.status === "Retired" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-zinc-500/40 bg-zinc-500/10 px-3 py-2 text-xs text-zinc-300">
            <Flag size={14} />
            <span>Retired. The franchise carries on without you.</span>
          </div>
        )}
      </header>

      {!isOwner && career.team && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Reputation" value={career.reputation} hint={repTier(career.reputation)} />
          <Stat label="Contract" value={`${career.contractYears} yr`} hint={`$${career.contractSalary.toFixed(1)}M / yr`} />
          <Stat label="Mode" value={career.mode} hint={isOwner ? "no firing risk" : "performance-based"} />
          <Stat label="Stints" value={career.stints.length} hint={`${career.stints.filter(s => s.fired).length} firings`} />
        </div>
      )}

      {career.status === "Fired" && (
        <Section title={`Job offers (${offers.length})`}>
          {offers.length === 0 ? (
            <Empty>No teams have made offers. Take a year off to rebuild your reputation, or retire.</Empty>
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => {
                const t = TEAMS_BY_ID[o.team];
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
                    <TeamLogo team={t} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base font-bold">{t.city} {t.name}</div>
                      <div className="text-[11px] text-muted">
                        {o.years} yr · ${o.salary.toFixed(1)}M / yr · {expectationLabel(o.expectations)}
                      </div>
                    </div>
                    <button
                      onClick={() => accept(o.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-xs font-bold text-bg tap hover:opacity-90"
                    >
                      Accept <ChevronRight size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => yearOff()}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold tap hover:bg-surface2">
              <Coffee size={12} /> Take a year off
            </button>
            <button onClick={() => retire()}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-500/40 bg-zinc-500/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-500/20">
              <Flag size={12} /> Retire from career
            </button>
          </div>
        </Section>
      )}

      <Section title="Career history">
        {career.stints.length === 0 ? (
          <Empty>You're just getting started. Win some games.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-surface2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Years</th>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-right">W-L</th>
                  <th className="px-3 py-2 text-right">Playoffs</th>
                  <th className="px-3 py-2 text-right">Titles</th>
                  <th className="px-3 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {career.stints.slice().reverse().map((s, i) => (
                  <StintRow key={i} stint={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function StintRow({ stint }: { stint: UserCareerStint }) {
  const team = TEAMS_BY_ID[stint.team];
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-mono">{stint.startYear}{stint.endYear ? `–${stint.endYear}` : "–present"}</td>
      <td className="px-3 py-2">
        {team && (
          <Link href={`/team/${team.id}`} className="flex items-center gap-2 hover:text-accent">
            <TeamLogo team={team} size={20} />
            <span>{team.city} {team.name}</span>
          </Link>
        )}
      </td>
      <td className="px-3 py-2 text-muted">{stint.role}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{stint.wins}-{stint.losses}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">{stint.playoffApps}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums">
        {stint.championships > 0 && <span className="text-fuchsia-300">★{stint.championships}</span>}
        {stint.championships === 0 && "—"}
      </td>
      <td className="px-3 py-2 text-xs">
        {stint.fired ? <span className="text-red-300">Fired — {stint.reason ?? ""}</span>
          : stint.endYear ? <span className="text-muted">Departed</span>
          : <span className="text-emerald-300">Active</span>}
      </td>
    </tr>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "Active": return "Active — contract in good standing";
    case "OnHotSeat": return "Hot seat — ownership unhappy";
    case "Fired": return "Free agent — review job offers";
    case "TakingYearOff": return "Sitting out the season";
    case "Retired": return "Retired";
    default: return s;
  }
}

function repTier(r: number): string {
  if (r >= 88) return "elite";
  if (r >= 78) return "respected";
  if (r >= 68) return "solid";
  if (r >= 55) return "below average";
  return "embattled";
}

function expectationLabel(e: string): string {
  switch (e) {
    case "WinNow": return "Win-Now expectations";
    case "Rebuild": return "Patient rebuild";
    case "Balanced": return "Balanced expectations";
    default: return e;
  }
}
