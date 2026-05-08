"use client";
import { use } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { TeamNav } from "@/components/team-nav";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { totalRevenue, totalExpense } from "@/lib/cpu/finances";
import { staffPayroll } from "@/lib/cpu/coachContracts";
import { currentTeamPayroll } from "@/lib/offseason/freeAgency";
import { cn } from "@/lib/utils";

export default function FinancesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  if (!league) return <Empty>No league yet.</Empty>;
  const team = TEAMS_BY_ID[id];
  if (!team) return <Empty>Unknown team.</Empty>;

  const isOwner = league.userMode === "Owner" && league.userTeam === id;
  const fin = league.finances?.[id];
  const history = (fin?.history ?? []).slice().reverse();
  const lifetime = fin?.totalProfit ?? 0;
  const last = history[0];
  const playerPayroll = currentTeamPayroll(league, id);
  const coachPayroll = staffPayroll(league, id);

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <TeamBanner team={team} subtitle="Finances" />
        <TeamNav teamId={team.id} />
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Team finances are <strong>Owner-mode only</strong>. The owner sees ticket revenue, jersey sales, P&L, and lifetime profit.
        </div>
      </div>
    );
  }

  // SVG line chart of net profit over time
  const W = 720, H = 200, P = 32;
  const sortedHistory = [...(fin?.history ?? [])].sort((a, b) => a.year - b.year);
  const minNet = sortedHistory.length ? Math.min(...sortedHistory.map((h) => h.net), 0) : 0;
  const maxNet = sortedHistory.length ? Math.max(...sortedHistory.map((h) => h.net), 100) : 100;
  const range = Math.max(maxNet - minNet, 50);
  const stepX = sortedHistory.length > 1 ? (W - P * 2) / (sortedHistory.length - 1) : 0;
  const yScale = (v: number) => P + ((maxNet - v) / range) * (H - P * 2);
  const path = sortedHistory
    .map((h, i) => `${i === 0 ? "M" : "L"} ${P + i * stepX} ${yScale(h.net)}`)
    .join(" ");
  const zeroY = yScale(0);

  return (
    <div className="space-y-4">
      <TeamBanner team={team} subtitle="Owner finances dashboard" />
      <TeamNav teamId={team.id} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Lifetime profit" value={`$${(lifetime).toFixed(0)}M`} hint={`${fin?.history.length ?? 0} seasons`} />
        <Stat label="Last season net" value={last ? `${last.net >= 0 ? "+" : ""}$${last.net}M` : "—"} hint={last ? `${last.year}` : ""} />
        <Stat label="Player payroll" value={`$${playerPayroll.toFixed(1)}M`} hint={`/ $${team.cap}M cap`} />
        <Stat label="Coach payroll" value={`$${coachPayroll.toFixed(1)}M`} hint="HC + OC + DC" />
      </div>

      {sortedHistory.length >= 2 && (
        <Panel title="Net profit / loss by year">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
            <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="currentColor" opacity={0.2} />
            <line x1={P} y1={P} x2={P} y2={H - P} stroke="currentColor" opacity={0.2} />
            <line x1={P} y1={zeroY} x2={W - P} y2={zeroY} stroke="rgb(255 255 255)" strokeDasharray="3 3" opacity={0.2} />
            <path d={path} fill="none" stroke="rgb(74 222 128)" strokeWidth={2} />
            {sortedHistory.map((h, i) => {
              const x = P + i * stepX;
              const y = yScale(h.net);
              return <circle key={h.year} cx={x} cy={y} r={2.5} fill={h.net >= 0 ? "rgb(74 222 128)" : "rgb(239 68 68)"} />;
            })}
            <text x={P - 4} y={yScale(maxNet)} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>${Math.round(maxNet)}M</text>
            <text x={P - 4} y={zeroY - 2} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>$0</text>
            <text x={P - 4} y={yScale(minNet) + 4} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>${Math.round(minNet)}M</text>
          </svg>
        </Panel>
      )}

      <Section title="Season-by-season breakdown">
        {history.length === 0 ? (
          <Empty>No seasons recorded yet. Finish a season to see the books.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-max text-xs">
              <thead className="bg-surface2 text-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Year</th>
                  <th className="px-2 py-1 text-right">Tickets</th>
                  <th className="px-2 py-1 text-right">Jerseys</th>
                  <th className="px-2 py-1 text-right">TV</th>
                  <th className="px-2 py-1 text-right">Sponsors</th>
                  <th className="px-2 py-1 text-right">Revenue</th>
                  <th className="px-2 py-1 text-right">Player</th>
                  <th className="px-2 py-1 text-right">Staff</th>
                  <th className="px-2 py-1 text-right">Facilities</th>
                  <th className="px-2 py-1 text-right">Expense</th>
                  <th className="px-2 py-1 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const rev = totalRevenue(h);
                  const exp = totalExpense(h);
                  return (
                    <tr key={h.year} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{h.year}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.ticketRevenue}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.jerseyRevenue}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.tvDealRevenue}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.sponsorRevenue}</td>
                      <td className="px-2 py-1 text-right font-bold tabular-nums">${rev}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.payrollExpense}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.staffExpense}</td>
                      <td className="px-2 py-1 text-right tabular-nums">${h.facilitiesExpense}</td>
                      <td className="px-2 py-1 text-right font-bold tabular-nums">${exp}</td>
                      <td className={cn(
                        "px-2 py-1 text-right font-bold tabular-nums",
                        h.net >= 0 ? "text-emerald-400" : "text-red-400",
                      )}>
                        {h.net >= 0 ? "+" : ""}${h.net}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Link href={`/team/${team.id}`} className="text-sm text-muted hover:text-fg">← Back to team page</Link>
    </div>
  );
}
