"use client";
import type { Team } from "@/lib/types";

/**
 * SVG field visualization, oriented horizontally.
 * Home is shown on the right end zone, away on the left.
 * `possession` indicates which team has the ball; `ballYL` is from offense's perspective (1–99).
 */
export function FieldView({
  home, away, possession, ballYL, toGo, down,
}: {
  home: Team; away: Team;
  possession: string;       // team id
  ballYL: number;           // 1–99 from offense view
  toGo: number;
  down: 1 | 2 | 3 | 4;
}) {
  const W = 1000;
  const H = 220;
  const EZ = 80;            // endzone width (pixels)
  const FW = W - EZ * 2;    // field width

  // Map ball to field x. If home has ball, advancing right; if away, advancing left.
  const homeHas = possession === home.id;
  const offX = homeHas
    ? EZ + ((100 - ballYL) / 100) * FW
    : EZ + (ballYL / 100) * FW;
  // First-down marker
  const fdYL = ballYL + toGo;
  const fdX = homeHas
    ? EZ + ((100 - Math.min(99, fdYL)) / 100) * FW
    : EZ + (Math.min(99, fdYL) / 100) * FW;

  const yardLines = Array.from({ length: 11 }, (_, i) => i); // 0..10 (0,10,...,100)
  const labels = ["G", "10", "20", "30", "40", "50", "40", "30", "20", "10", "G"];

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-[#0a2d10]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {/* Field grass */}
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e3318" />
            <stop offset="100%" stopColor="#082007" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#grass)" />

        {/* Stripes */}
        {yardLines.slice(0, 10).map((i) => (
          <rect key={i} x={EZ + (i * FW) / 10} y={0} width={FW / 10} height={H} fill={i % 2 === 0 ? "#0c2a14" : "#0e3318"} opacity={0.5} />
        ))}

        {/* End zones */}
        <rect x={0} y={0} width={EZ} height={H} fill={away.primary} opacity={0.85} />
        <rect x={W - EZ} y={0} width={EZ} height={H} fill={home.primary} opacity={0.85} />
        <text x={EZ / 2} y={H / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={20} fontWeight={700} transform={`rotate(-90 ${EZ / 2} ${H / 2})`} opacity={0.9}>
          {away.abbr}
        </text>
        <text x={W - EZ / 2} y={H / 2} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontSize={20} fontWeight={700} transform={`rotate(90 ${W - EZ / 2} ${H / 2})`} opacity={0.9}>
          {home.abbr}
        </text>

        {/* Yard lines */}
        {yardLines.map((i) => {
          const x = EZ + (i * FW) / 10;
          return (
            <g key={i}>
              <line x1={x} y1={20} x2={x} y2={H - 20} stroke="rgba(255,255,255,0.7)" strokeWidth={i === 5 ? 2 : 1} />
              <text x={x} y={H - 8} fill="rgba(255,255,255,0.6)" fontSize={11} textAnchor="middle">{labels[i]}</text>
              <text x={x} y={16} fill="rgba(255,255,255,0.6)" fontSize={11} textAnchor="middle">{labels[i]}</text>
            </g>
          );
        })}

        {/* Hash marks */}
        {Array.from({ length: 91 }, (_, i) => i + 5).map((i) => {
          const x = EZ + (i / 100) * FW;
          if (i % 5 === 0) return null;
          return (
            <g key={i}>
              <line x1={x} y1={68} x2={x} y2={72} stroke="rgba(255,255,255,0.4)" />
              <line x1={x} y1={H - 68} x2={x} y2={H - 72} stroke="rgba(255,255,255,0.4)" />
            </g>
          );
        })}

        {/* First down line */}
        {toGo > 0 && fdX > EZ && fdX < W - EZ && (
          <line x1={fdX} y1={20} x2={fdX} y2={H - 20} stroke="#fbbf24" strokeWidth={3} strokeDasharray="6 4" opacity={0.85} />
        )}

        {/* Line of scrimmage */}
        <line x1={offX} y1={20} x2={offX} y2={H - 20} stroke="#3b82f6" strokeWidth={3} opacity={0.9} />

        {/* Football */}
        <g transform={`translate(${offX} ${H / 2})`}>
          <ellipse rx={9} ry={5.5} fill="#7a3f1d" stroke="#fef3c7" strokeWidth={1.5} />
          <line x1={-4} y1={0} x2={4} y2={0} stroke="#fef3c7" strokeWidth={1} />
        </g>
      </svg>
      <div className="flex items-center justify-between border-t border-border bg-bg/80 px-3 py-1.5 text-xs">
        <span className="font-mono text-muted">
          {down === 1 ? "1st" : down === 2 ? "2nd" : down === 3 ? "3rd" : "4th"} & {toGo === 0 ? "Goal" : toGo}
        </span>
        <span className="font-mono text-muted">
          Ball on the {ballYL <= 50 ? `${homeHas ? home.abbr : away.abbr} ${ballYL}` : `${homeHas ? away.abbr : home.abbr} ${100 - ballYL}`}
        </span>
      </div>
    </div>
  );
}
