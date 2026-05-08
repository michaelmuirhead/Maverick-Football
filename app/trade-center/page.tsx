"use client";
import { useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section, Stat } from "@/components/panels";
import { TeamLogo } from "@/components/team-logo";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TradeBuilder } from "@/components/trade-builder";
import { OfferCard } from "@/components/offer-card";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Inbox, History, Loader2, Plus } from "lucide-react";
import { describeAssets } from "@/lib/cpu/tradeExecute";
import { userCan } from "@/lib/cpu/career";

type Tab = "inbox" | "build" | "log";

export default function TradeCenterPage() {
  const league = useLeague((s) => s.league);
  const generateUserOffers = useLeague((s) => s.generateUserOffers);
  const busy = useLeague((s) => s.busy);
  const [tab, setTab] = useState<Tab>("inbox");
  const [generating, setGenerating] = useState(false);

  if (!league) return <Empty>No league yet.</Empty>;
  if (!league.userTeam) return <Empty>No user team selected.</Empty>;

  const userTeam = TEAMS_BY_ID[league.userTeam];
  const inbox = league.pendingOffers
    .filter((o) => o.status === "pending" && (o.toTeam === league.userTeam || o.fromTeam === league.userTeam))
    .sort((a, b) => b.ts - a.ts);
  const recent = league.tradeLog.slice(0, 30);

  const tradeWindowOpen = (league.phase === "RegularSeason" && league.week <= 9) || league.phase.startsWith("Offseason");
  const canTrade = userCan(league, "trades");
  const deadlineNote =
    league.phase === "RegularSeason" && league.week > 9 ? "Trade deadline has passed." :
    league.phase === "Playoffs" ? "Trades are not allowed during the playoffs." :
    league.phase === "RegularSeason" && league.week === 9 ? "Final week before deadline!" :
    null;

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ArrowLeftRight size={20} className="text-accent" />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">Trade Center</h1>
            <p className="text-xs text-muted">
              {tradeWindowOpen
                ? `Trade window OPEN — ${league.year}, Week ${league.week || "0 (offseason)"}`
                : "Trade window CLOSED"}
              {deadlineNote && <span className="ml-2 text-amber-300">• {deadlineNote}</span>}
            </p>
          </div>
          <button
            onClick={async () => { setGenerating(true); await generateUserOffers(2); setGenerating(false); }}
            disabled={generating || !tradeWindowOpen || !canTrade}
            title={!canTrade ? "Your role doesn't manage trades" : undefined}
            className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent tap hover:bg-accent/20 disabled:opacity-40"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Generate offers from CPU
          </button>
        </div>
        {!canTrade && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Your General Manager handles trades. As <strong>{league.userMode}</strong> you can review activity but not initiate moves.
          </div>
        )}

        <nav className="mt-4 flex gap-1">
          <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")} icon={<Inbox size={14} />}>
            Inbox{inbox.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-bg">{inbox.length}</span>}
          </TabBtn>
          <TabBtn active={tab === "build"} onClick={() => setTab("build")} icon={<ArrowLeftRight size={14} />}>
            Build Trade
          </TabBtn>
          <TabBtn active={tab === "log"} onClick={() => setTab("log")} icon={<History size={14} />}>
            League Activity
          </TabBtn>
        </nav>
      </header>

      {tab === "inbox" && (
        <Section title={`Pending offers (${inbox.length})`}>
          {inbox.length === 0 ? (
            <Empty>
              No pending offers. Try the <button className="text-accent hover:underline" onClick={async () => { setGenerating(true); await generateUserOffers(2); setGenerating(false); }}>Generate offers</button> button or build your own trade.
            </Empty>
          ) : (
            <div className="space-y-2">
              {inbox.map((o) => <OfferCard key={o.id} league={league} offer={o} />)}
            </div>
          )}
        </Section>
      )}

      {tab === "build" && (
        <>
          {!tradeWindowOpen && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              Trade window is closed. Wait for the offseason or next regular season (Wk 1–9).
            </div>
          )}
          <TradeBuilder league={league} />
        </>
      )}

      {tab === "log" && (
        <Section title="Recent league trades">
          {recent.length === 0 ? (
            <Empty>No trades yet. Sim a season — the league will get noisy.</Empty>
          ) : (
            <ul className="space-y-2">
              {recent.map((tr) => {
                const a = TEAMS_BY_ID[tr.teamA];
                const b = TEAMS_BY_ID[tr.teamB];
                return (
                  <li key={tr.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-zinc-500/15 px-1.5 py-0.5 font-bold uppercase text-zinc-300">
                        {tr.year}{tr.week > 0 ? ` W${tr.week}` : ""}
                      </span>
                      <TeamLogo team={a} size={20} />
                      <span className="font-medium">{a.abbr}</span>
                      <ArrowLeftRight size={10} className="text-muted" />
                      <TeamLogo team={b} size={20} />
                      <span className="font-medium">{b.abbr}</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border bg-bg p-2 text-xs">
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{a.abbr} sends</div>
                        <div className="line-clamp-3">{describeAssets(league, tr.aGives) || "—"}</div>
                      </div>
                      <div className="rounded-md border border-border bg-bg p-2 text-xs">
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{b.abbr} sends</div>
                        <div className="line-clamp-3">{describeAssets(league, tr.bGives) || "—"}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs tap",
        active ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface2",
      )}>
      {icon}{children}
    </button>
  );
}
