"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { Empty, Panel, Section } from "@/components/panels";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamLogo } from "@/components/team-logo";
import { ChevronRight, Download, Upload, Plus, Trash2, ArrowRightCircle } from "lucide-react";

export default function SavesPage() {
  const slots = useLeague((s) => s.saveSlots);
  const activeId = useLeague((s) => s.activeSlotId);
  const refresh = useLeague((s) => s.refreshSaveSlots);
  const create = useLeague((s) => s.createNewSave);
  const switchSave = useLeague((s) => s.switchSave);
  const del = useLeague((s) => s.deleteSave);
  const rename = useLeague((s) => s.renameSave);
  const exportSave = useLeague((s) => s.exportSave);
  const importSave = useLeague((s) => s.importSave);

  const [newName, setNewName] = useState("New Dynasty");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-4">
      <Section title="Save slots">
        <Panel title="Create new save">
          <div className="flex flex-wrap gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[160px] rounded-md border border-border bg-bg px-3 py-2 text-sm"
              placeholder="Save name"
            />
            <button
              onClick={async () => { await create(newName.trim() || "Untitled"); window.location.href = "/new-game"; }}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-bold text-bg tap hover:opacity-90"
            >
              <Plus size={14} /> Create
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold tap hover:bg-surface2"
            >
              <Upload size={14} /> Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                const r = await importSave(text);
                setImportMsg(r.ok ? "Imported successfully." : `Import failed — ${r.reason}`);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
          </div>
          {importMsg && <div className="mt-2 text-xs text-muted">{importMsg}</div>}
        </Panel>
      </Section>

      <Section title="Existing saves">
        {slots.length === 0 ? <Empty>No saves yet.</Empty> : (
          <ul className="space-y-2">
            {slots.map((m) => {
              const team = m.league.userTeam ? TEAMS_BY_ID[m.league.userTeam] : null;
              const isActive = m.id === activeId;
              return (
                <li key={m.id} className={`rounded-lg border p-3 ${isActive ? "border-accent bg-accent/5" : "border-border bg-surface"}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    {team ? <TeamLogo team={team} size={32} /> : <div className="h-8 w-8 rounded-md bg-surface2" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          defaultValue={m.name}
                          onBlur={async (e) => {
                            const v = e.currentTarget.value.trim();
                            if (v && v !== m.name) await rename(m.id, v);
                          }}
                          className="w-48 max-w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-border focus:border-accent focus:outline-none"
                        />
                        {isActive && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">ACTIVE</span>}
                      </div>
                      <div className="text-[11px] text-muted">
                        {team ? `${team.city} ${team.name}` : "—"} • {m.league.year} • Founded {m.league.founded}
                      </div>
                      <div className="text-[10px] text-muted">Updated {new Date(m.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!isActive && (
                        <button onClick={() => switchSave(m.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-surface2">
                          <ArrowRightCircle size={12} /> Load
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const data = await exportSave(m.id);
                          if (!data) return;
                          const blob = new Blob([data], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url; a.download = `maverick-${m.id}.json`; a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs hover:bg-surface2"
                      >
                        <Download size={12} /> Export
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
                          await del(m.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        ← Back to dashboard
      </Link>
    </div>
  );
}
