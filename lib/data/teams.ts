import type { Team } from "@/lib/types";

export const TEAMS: Team[] = [
  // AFC East
  { id: "BUF", city: "Buffalo", name: "Bills", abbr: "BUF", conference: "AFC", division: "East", primary: "#00338D", secondary: "#C60C30", stadium: "Highmark Stadium", founded: 1960, prestige: 84, offenseScheme: "Spread", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 2 },
  { id: "MIA", city: "Miami", name: "Dolphins", abbr: "MIA", conference: "AFC", division: "East", primary: "#008E97", secondary: "#FC4C02", stadium: "Hard Rock Stadium", founded: 1966, prestige: 76, offenseScheme: "Spread", defenseScheme: "Cover 2", cap: 255, isIndoor: false, climate: "Hot", hfa: 1 },
  { id: "NE",  city: "New England", name: "Patriots", abbr: "NE",  conference: "AFC", division: "East", primary: "#002244", secondary: "#C60C30", stadium: "Gillette Stadium", founded: 1960, prestige: 70, offenseScheme: "Pro Style", defenseScheme: "3-4", cap: 255, isIndoor: false, climate: "Cold", hfa: 1 },
  { id: "NYJ", city: "New York", name: "Jets", abbr: "NYJ", conference: "AFC", division: "East", primary: "#125740", secondary: "#000000", stadium: "MetLife Stadium", founded: 1960, prestige: 71, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 1 },
  // AFC North
  { id: "BAL", city: "Baltimore", name: "Ravens", abbr: "BAL", conference: "AFC", division: "North", primary: "#241773", secondary: "#9E7C0C", stadium: "M&T Bank Stadium", founded: 1996, prestige: 86, offenseScheme: "Pro Style", defenseScheme: "3-4", cap: 255, isIndoor: false, climate: "Mild", hfa: 2 },
  { id: "CIN", city: "Cincinnati", name: "Bengals", abbr: "CIN", conference: "AFC", division: "North", primary: "#FB4F14", secondary: "#000000", stadium: "Paycor Stadium", founded: 1968, prestige: 80, offenseScheme: "Air Raid", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Mild", hfa: 1 },
  { id: "CLE", city: "Cleveland", name: "Browns", abbr: "CLE", conference: "AFC", division: "North", primary: "#311D00", secondary: "#FF3C00", stadium: "Cleveland Browns Stadium", founded: 1946, prestige: 73, offenseScheme: "Pro Style", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 1 },
  { id: "PIT", city: "Pittsburgh", name: "Steelers", abbr: "PIT", conference: "AFC", division: "North", primary: "#FFB612", secondary: "#101820", stadium: "Acrisure Stadium", founded: 1933, prestige: 81, offenseScheme: "Power Run", defenseScheme: "3-4", cap: 255, isIndoor: false, climate: "Cold", hfa: 2 },
  // AFC South
  { id: "HOU", city: "Houston", name: "Texans", abbr: "HOU", conference: "AFC", division: "South", primary: "#03202F", secondary: "#A71930", stadium: "NRG Stadium", founded: 2002, prestige: 79, offenseScheme: "Spread", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Hot", hfa: 1 },
  { id: "IND", city: "Indianapolis", name: "Colts", abbr: "IND", conference: "AFC", division: "South", primary: "#002C5F", secondary: "#A2AAAD", stadium: "Lucas Oil Stadium", founded: 1953, prestige: 74, offenseScheme: "West Coast", defenseScheme: "Cover 2", cap: 255, isIndoor: true, climate: "Mild", hfa: 1 },
  { id: "JAX", city: "Jacksonville", name: "Jaguars", abbr: "JAX", conference: "AFC", division: "South", primary: "#101820", secondary: "#D7A22A", stadium: "EverBank Stadium", founded: 1995, prestige: 72, offenseScheme: "Spread", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Hot", hfa: 1 },
  { id: "TEN", city: "Tennessee", name: "Titans", abbr: "TEN", conference: "AFC", division: "South", primary: "#0C2340", secondary: "#4B92DB", stadium: "Nissan Stadium", founded: 1960, prestige: 70, offenseScheme: "Power Run", defenseScheme: "3-4", cap: 255, isIndoor: false, climate: "Mild", hfa: 1 },
  // AFC West
  { id: "DEN", city: "Denver", name: "Broncos", abbr: "DEN", conference: "AFC", division: "West", primary: "#FB4F14", secondary: "#002244", stadium: "Empower Field at Mile High", founded: 1960, prestige: 75, offenseScheme: "Pro Style", defenseScheme: "3-4", cap: 255, isIndoor: false, climate: "Cold", hfa: 2 },
  { id: "KC",  city: "Kansas City", name: "Chiefs", abbr: "KC",  conference: "AFC", division: "West", primary: "#E31837", secondary: "#FFB81C", stadium: "GEHA Field at Arrowhead", founded: 1960, prestige: 92, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 3 },
  { id: "LV",  city: "Las Vegas", name: "Raiders", abbr: "LV",  conference: "AFC", division: "West", primary: "#000000", secondary: "#A5ACAF", stadium: "Allegiant Stadium", founded: 1960, prestige: 71, offenseScheme: "Pro Style", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Hot", hfa: 1 },
  { id: "LAC", city: "Los Angeles", name: "Chargers", abbr: "LAC", conference: "AFC", division: "West", primary: "#0080C6", secondary: "#FFC20E", stadium: "SoFi Stadium", founded: 1960, prestige: 78, offenseScheme: "Air Raid", defenseScheme: "3-4", cap: 255, isIndoor: true, climate: "Warm", hfa: 0 },
  // NFC East
  { id: "DAL", city: "Dallas", name: "Cowboys", abbr: "DAL", conference: "NFC", division: "East", primary: "#003594", secondary: "#869397", stadium: "AT&T Stadium", founded: 1960, prestige: 83, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Hot", hfa: 1 },
  { id: "NYG", city: "New York", name: "Giants", abbr: "NYG", conference: "NFC", division: "East", primary: "#0B2265", secondary: "#A71930", stadium: "MetLife Stadium", founded: 1925, prestige: 72, offenseScheme: "Pro Style", defenseScheme: "3-4", cap: 255, isIndoor: false, climate: "Cold", hfa: 1 },
  { id: "PHI", city: "Philadelphia", name: "Eagles", abbr: "PHI", conference: "NFC", division: "East", primary: "#004C54", secondary: "#A5ACAF", stadium: "Lincoln Financial Field", founded: 1933, prestige: 88, offenseScheme: "Spread", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 2 },
  { id: "WAS", city: "Washington", name: "Commanders", abbr: "WAS", conference: "NFC", division: "East", primary: "#5A1414", secondary: "#FFB612", stadium: "Northwest Stadium", founded: 1932, prestige: 74, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Mild", hfa: 1 },
  // NFC North
  { id: "CHI", city: "Chicago", name: "Bears", abbr: "CHI", conference: "NFC", division: "North", primary: "#0B162A", secondary: "#C83803", stadium: "Soldier Field", founded: 1920, prestige: 73, offenseScheme: "Pro Style", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 1 },
  { id: "DET", city: "Detroit", name: "Lions", abbr: "DET", conference: "NFC", division: "North", primary: "#0076B6", secondary: "#B0B7BC", stadium: "Ford Field", founded: 1930, prestige: 87, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Cold", hfa: 2 },
  { id: "GB",  city: "Green Bay", name: "Packers", abbr: "GB",  conference: "NFC", division: "North", primary: "#203731", secondary: "#FFB612", stadium: "Lambeau Field", founded: 1919, prestige: 84, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Cold", hfa: 3 },
  { id: "MIN", city: "Minnesota", name: "Vikings", abbr: "MIN", conference: "NFC", division: "North", primary: "#4F2683", secondary: "#FFC62F", stadium: "U.S. Bank Stadium", founded: 1961, prestige: 79, offenseScheme: "West Coast", defenseScheme: "Cover 2", cap: 255, isIndoor: true, climate: "Cold", hfa: 1 },
  // NFC South
  { id: "ATL", city: "Atlanta", name: "Falcons", abbr: "ATL", conference: "NFC", division: "South", primary: "#A71930", secondary: "#000000", stadium: "Mercedes-Benz Stadium", founded: 1966, prestige: 75, offenseScheme: "Spread", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Warm", hfa: 1 },
  { id: "CAR", city: "Carolina", name: "Panthers", abbr: "CAR", conference: "NFC", division: "South", primary: "#0085CA", secondary: "#101820", stadium: "Bank of America Stadium", founded: 1995, prestige: 68, offenseScheme: "Pro Style", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Mild", hfa: 1 },
  { id: "NO",  city: "New Orleans", name: "Saints", abbr: "NO",  conference: "NFC", division: "South", primary: "#D3BC8D", secondary: "#101820", stadium: "Caesars Superdome", founded: 1967, prestige: 73, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Warm", hfa: 2 },
  { id: "TB",  city: "Tampa Bay", name: "Buccaneers", abbr: "TB",  conference: "NFC", division: "South", primary: "#D50A0A", secondary: "#34302B", stadium: "Raymond James Stadium", founded: 1976, prestige: 78, offenseScheme: "Air Raid", defenseScheme: "Tampa 2", cap: 255, isIndoor: false, climate: "Hot", hfa: 1 },
  // NFC West
  { id: "ARI", city: "Arizona", name: "Cardinals", abbr: "ARI", conference: "NFC", division: "West", primary: "#97233F", secondary: "#000000", stadium: "State Farm Stadium", founded: 1898, prestige: 70, offenseScheme: "Air Raid", defenseScheme: "3-4", cap: 255, isIndoor: true, climate: "Hot", hfa: 1 },
  { id: "LAR", city: "Los Angeles", name: "Rams", abbr: "LAR", conference: "NFC", division: "West", primary: "#003594", secondary: "#FFA300", stadium: "SoFi Stadium", founded: 1936, prestige: 80, offenseScheme: "West Coast", defenseScheme: "4-3", cap: 255, isIndoor: true, climate: "Warm", hfa: 0 },
  { id: "SF",  city: "San Francisco", name: "49ers", abbr: "SF",  conference: "NFC", division: "West", primary: "#AA0000", secondary: "#B3995D", stadium: "Levi's Stadium", founded: 1946, prestige: 89, offenseScheme: "West Coast", defenseScheme: "Cover 2", cap: 255, isIndoor: false, climate: "Mild", hfa: 1 },
  { id: "SEA", city: "Seattle", name: "Seahawks", abbr: "SEA", conference: "NFC", division: "West", primary: "#002244", secondary: "#69BE28", stadium: "Lumen Field", founded: 1976, prestige: 76, offenseScheme: "Spread", defenseScheme: "4-3", cap: 255, isIndoor: false, climate: "Mild", hfa: 3 },
];

export const TEAMS_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

export const DIVISIONS = ["East", "North", "South", "West"] as const;
export const CONFERENCES = ["AFC", "NFC"] as const;

export function teamsInDivision(conf: "AFC" | "NFC", div: "East" | "North" | "South" | "West") {
  return TEAMS.filter((t) => t.conference === conf && t.division === div);
}

export function teamsInConference(conf: "AFC" | "NFC") {
  return TEAMS.filter((t) => t.conference === conf);
}
