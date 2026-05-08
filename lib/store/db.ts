"use client";
import Dexie, { type Table } from "dexie";
import type { League, SaveMeta } from "@/lib/types";

export interface SaveSlot {
  id: string;            // "main" by default; can be a custom slot id
  name?: string;
  league: League;
  updatedAt: number;
  createdAt?: number;
}

class MaverickDB extends Dexie {
  saves!: Table<SaveSlot, string>;
  meta!: Table<{ key: string; value: string }, string>;
  constructor() {
    super("maverick-football");
    this.version(1).stores({
      saves: "id, updatedAt",
    });
    this.version(2).stores({
      saves: "id, updatedAt",
      meta: "key",
    });
  }
}

export const db = typeof window !== "undefined" ? new MaverickDB() : (null as unknown as MaverickDB);

const ACTIVE_SLOT_KEY = "activeSlotId";

export async function getActiveSlotId(): Promise<string> {
  if (!db) return "main";
  const m = await db.meta.get(ACTIVE_SLOT_KEY);
  return m?.value ?? "main";
}

export async function setActiveSlotId(id: string) {
  if (!db) return;
  await db.meta.put({ key: ACTIVE_SLOT_KEY, value: id });
}

export async function saveLeague(league: League) {
  if (!db) return;
  const id = await getActiveSlotId();
  const existing = await db.saves.get(id);
  await db.saves.put({
    id,
    name: existing?.name,
    league,
    updatedAt: Date.now(),
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export async function loadLeague(): Promise<League | null> {
  if (!db) return null;
  const id = await getActiveSlotId();
  const slot = await db.saves.get(id);
  return slot?.league ?? null;
}

export async function deleteLeague() {
  if (!db) return;
  const id = await getActiveSlotId();
  await db.saves.delete(id);
}

export async function listSaves(): Promise<(SaveSlot & { id: string })[]> {
  if (!db) return [];
  const slots = await db.saves.orderBy("updatedAt").reverse().toArray();
  return slots;
}

export async function listSaveMetas(): Promise<SaveMeta[]> {
  const slots = await listSaves();
  return slots.map((s) => ({
    id: s.id,
    name: s.name ?? s.league.userTeam ?? "Untitled",
    createdAt: s.createdAt ?? s.updatedAt,
    updatedAt: s.updatedAt,
    league: {
      year: s.league.year,
      userTeam: s.league.userTeam,
      founded: s.league.founded,
    },
  }));
}

export async function createNewSlot(name: string): Promise<string> {
  if (!db) return "main";
  const id = `s${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await setActiveSlotId(id);
  await db.saves.put({
    id, name,
    league: {} as League,        // placeholder; will be filled by newLeague
    updatedAt: Date.now(),
    createdAt: Date.now(),
  });
  return id;
}

export async function switchToSlot(id: string) {
  await setActiveSlotId(id);
}

export async function deleteSlot(id: string) {
  if (!db) return;
  await db.saves.delete(id);
}

export async function renameSlot(id: string, name: string) {
  if (!db) return;
  const s = await db.saves.get(id);
  if (!s) return;
  await db.saves.put({ ...s, name });
}

export async function exportSlot(id: string): Promise<string | null> {
  if (!db) return null;
  const s = await db.saves.get(id);
  if (!s) return null;
  return JSON.stringify({ version: 2, slot: s });
}

export async function importSlot(jsonText: string): Promise<{ ok: boolean; reason?: string; id?: string }> {
  if (!db) return { ok: false, reason: "No database" };
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed?.slot?.league) return { ok: false, reason: "Invalid save file" };
    const newId = `imp${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const slot: SaveSlot = {
      id: newId,
      name: (parsed.slot.name ?? "Imported") + " (imported)",
      league: parsed.slot.league,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.saves.put(slot);
    return { ok: true, id: newId };
  } catch (e) {
    return { ok: false, reason: "Invalid JSON" };
  }
}
