import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function round(n: number, places = 0) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

export function pct(n: number, places = 1) {
  return `${(n * 100).toFixed(places)}%`;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtYards(n: number) {
  return `${n.toFixed(0)} yd`;
}

export function shortName(name: string) {
  const parts = name.split(" ");
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export function age(year: number, birthYear: number) {
  return year - birthYear;
}

export function gradeColor(ovr: number) {
  if (ovr >= 90) return "text-emerald-400";
  if (ovr >= 80) return "text-green-400";
  if (ovr >= 75) return "text-lime-400";
  if (ovr >= 70) return "text-yellow-400";
  if (ovr >= 65) return "text-orange-400";
  return "text-red-400";
}

export function tierBadge(ovr: number): { label: string; cls: string } {
  if (ovr >= 95) return { label: "ELITE", cls: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40" };
  if (ovr >= 88) return { label: "STAR", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
  if (ovr >= 80) return { label: "PRO", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" };
  if (ovr >= 73) return { label: "STARTER", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" };
  if (ovr >= 65) return { label: "ROTATION", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" };
  return { label: "DEPTH", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
}
