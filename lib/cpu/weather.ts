import { RNG } from "@/lib/rng";
import type { Game, League, Weather } from "@/lib/types";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { clamp } from "@/lib/utils";

// =====================================================================
// Weather + home-field advantage. Outdoor stadiums roll weather based on
// week + climate. Indoor games are always Dome (no effects).
// =====================================================================

export function rollWeather(league: League, game: Game): Weather {
  if (game.weather) return game.weather;
  const home = TEAMS_BY_ID[game.home];
  if (home.isIndoor) {
    game.weather = { condition: "Dome", tempF: 72 };
    return game.weather;
  }
  const rng = new RNG(`weather:${game.id}`);
  const wk = game.week;
  const climate = home.climate ?? "Mild";

  let tempF = 60;
  if (climate === "Cold") tempF = wk <= 4 ? 70 : wk <= 9 ? 55 : wk <= 13 ? 40 : 28;
  else if (climate === "Mild") tempF = wk <= 6 ? 75 : wk <= 12 ? 60 : 45;
  else if (climate === "Warm") tempF = wk <= 6 ? 82 : wk <= 12 ? 70 : 60;
  else /* Hot */ tempF = wk <= 6 ? 90 : wk <= 12 ? 78 : 65;
  tempF += Math.round(rng.normal(0, 5));

  let condition: Weather["condition"] = "Clear";
  let windMph: number | undefined = Math.max(0, Math.round(rng.normal(7, 4)));

  // Snow chance — late season, cold climates only
  const snowChance = climate === "Cold" && wk >= 12 ? 0.18 + (wk - 12) * 0.04 : 0;
  if (snowChance > 0 && rng.chance(snowChance)) {
    condition = "Snow";
    tempF = clamp(tempF, 10, 32);
    windMph = clamp((windMph ?? 0) + 6, 5, 30);
  } else if (rng.chance(0.18)) {
    condition = "Rain";
    windMph = clamp((windMph ?? 0) + 3, 2, 25);
  } else if ((windMph ?? 0) >= 15) {
    condition = "Wind";
  } else if (climate === "Cold" && wk >= 14 && tempF < 25) {
    condition = "Cold";
  }

  game.weather = { condition, windMph, tempF };
  return game.weather;
}

/** Return sim modifiers for a given weather state. */
export function weatherModifiers(weather: Weather | undefined): {
  passYdsMult: number;
  rushYdsMult: number;
  fgRangePenalty: number;     // yards subtracted from effective FG range
  bigPlayMult: number;
  fumbleBonus: number;
} {
  if (!weather || weather.condition === "Dome" || weather.condition === "Clear") {
    return { passYdsMult: 1, rushYdsMult: 1, fgRangePenalty: 0, bigPlayMult: 1, fumbleBonus: 0 };
  }
  switch (weather.condition) {
    case "Snow":
      return { passYdsMult: 0.85, rushYdsMult: 1.04, fgRangePenalty: 8, bigPlayMult: 0.7, fumbleBonus: 0.012 };
    case "Rain":
      return { passYdsMult: 0.92, rushYdsMult: 0.96, fgRangePenalty: 4, bigPlayMult: 0.85, fumbleBonus: 0.018 };
    case "Wind":
      return { passYdsMult: 0.88, rushYdsMult: 1.0, fgRangePenalty: 6, bigPlayMult: 0.78, fumbleBonus: 0.004 };
    case "Cold":
      return { passYdsMult: 0.95, rushYdsMult: 1.0, fgRangePenalty: 3, bigPlayMult: 0.92, fumbleBonus: 0.005 };
    default:
      return { passYdsMult: 1, rushYdsMult: 1, fgRangePenalty: 0, bigPlayMult: 1, fumbleBonus: 0 };
  }
}

export function weatherEmoji(condition?: Weather["condition"]): string {
  switch (condition) {
    case "Snow": return "❄️";
    case "Rain": return "🌧";
    case "Wind": return "💨";
    case "Cold": return "🥶";
    case "Dome": return "🏟";
    default: return "☀️";
  }
}

export function describeWeather(w?: Weather): string {
  if (!w) return "—";
  if (w.condition === "Dome") return "Dome";
  const tempPart = w.tempF !== undefined ? `${w.tempF}°F` : "";
  const windPart = w.windMph ? `${w.windMph}mph wind` : "";
  return [w.condition, tempPart, windPart].filter(Boolean).join(" · ");
}

/** Home-field advantage modifier (applied as small ratings boost on home team). */
export function hfaBoost(home: { hfa?: number }): number {
  return (home.hfa ?? 0) * 0.4;     // 0..1.2 ratings points
}
