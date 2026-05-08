"use client";
import Link from "next/link";
import type { League, TradeAsset, TradeOffer } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "./team-logo";
import { useLeague } from "@/lib/store/league";
import { describeAsset } from "@/lib/cpu/tradeExecute";
import { baseValueOf, valueOfAssetsTo } from "@/lib/cpu/tradeValue";
import { userCan } from "@/lib/cpu/career";
import { Check, X, ArrowLeftRight } from "lucide-react";
import { cn, gradeColor } from "@/lib/utils";
import { useState } from "react";

export function OfferCard({ league, offer }: { league: League; offer: TradeOffer }) {
  const accept = useLeague((s) => s.acceptOffer);
  const reject = useLeague((s) => s.rejectOffer);
  const [status, setStatus] = useState<{ ok: boolean; reason?: string } | null>(null);
  const fromTeam = TEAMS_BY_ID[offer.fromTeam];
  const toTeam = TEAMS_BY_ID[offer.toTeam];

  // From the user's POV
  const userIsRecipient = offer.toTeam === league.userTeam;
  const userValueOfReceived = valueOfAssetsTo(league, league.userTeam!, userIsRecipient ? offer.fromAssets : offer.toAssets);
  const userValueOfGiven = valueOfAssetsTo(league, league.userTeam!, userIsRecipient ? offer.toAssets : offer.fromAssets);
  const fairness = userValueOfReceived / Math.max(1, userValueOfGiven);

  if (offer.status !== "pending") {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 opacity-70">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={cn("rounded px-1.5 py-0.5 font-bold uppercase",
            offer.status === "accepted" ? "bg-emerald-500/15 text-emerald-300" :
            offer.status === "rejected" ? "bg-red-500/15 text-red-300" :
            "bg-zinc-500/15 text-zinc-300")}>
            {offer.status}
          </span>
          <span>{fromTeam.abbr} ↔ {toTeam.abbr}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-surface p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-accent">OFFER</span>
        <TeamLogo team={fromTeam} size={20} />
        <span className="font-medium">{fromTeam.name}</span>
        <ArrowLeftRight size={12} className="text-muted" />
        <TeamLogo team={toTeam} size={20} />
        <span className="font-medium">{toTeam.name}</span>
        <span className="ml-auto text-[10px] text-muted">
          {offer.week > 0 ? `Wk ${offer.week}` : "Offseason"} · {offer.year}
        </span>
      </div>

      {offer.message && <div className="mt-2 text-xs italic text-muted">"{offer.message}"</div>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <AssetList league={league} title={`${fromTeam.abbr} sends`} assets={offer.fromAssets} />
        <AssetList league={league} title={`${toTeam.abbr} sends`} assets={offer.toAssets} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>Your fairness: <span className={cn("font-mono", fairness >= 0.95 ? "text-emerald-400" : fairness >= 0.85 ? "text-yellow-400" : "text-red-400")}>{Math.round(fairness * 100)}%</span></span>
      </div>

      {status && (
        <div className={cn("mt-2 rounded-md border px-3 py-2 text-xs",
          status.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/40 bg-red-500/10 text-red-200")}>
          {status.ok ? "Trade completed." : `Failed — ${status.reason ?? ""}`}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {userCan(league, "trades") ? (
          <>
            <button
              onClick={() => {
                const r = accept(offer.id);
                setStatus(r);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-bg tap hover:opacity-90"
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => reject(offer.id)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface2 tap"
            >
              <X size={12} /> Reject
            </button>
          </>
        ) : (
          <span className="text-[11px] italic text-muted">Your GM is reviewing this offer.</span>
        )}
      </div>
    </div>
  );
}

function AssetList({ league, title, assets }: { league: League; title: string; assets: TradeAsset[] }) {
  return (
    <div className="rounded-md border border-border bg-bg p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{title}</div>
      <ul className="space-y-1">
        {assets.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            {a.kind === "player" && a.playerId && league.players[a.playerId] ? (
              <PlayerAsset league={league} playerId={a.playerId} />
            ) : (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">{describeAsset(league, a)}</span>
            )}
          </li>
        ))}
        {!assets.length && <li className="text-[10px] text-muted">—</li>}
      </ul>
    </div>
  );
}

function PlayerAsset({ league, playerId }: { league: League; playerId: string }) {
  const p = league.players[playerId];
  if (!p) return <span className="text-muted">unknown</span>;
  return (
    <Link href={`/player/${p.id}`} className="flex flex-1 items-center gap-2 hover:text-accent">
      <span className="grid h-6 w-8 shrink-0 place-items-center rounded bg-surface2 font-mono text-[10px] text-muted">{p.position}</span>
      <span className="flex-1 truncate">{p.firstName[0]}. {p.lastName}</span>
      <span className={cn("font-mono text-xs", gradeColor(p.ovr))}>{p.ovr}</span>
    </Link>
  );
}
