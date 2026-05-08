"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useLeague } from "@/lib/store/league";
import { TEAMS_BY_ID } from "@/lib/data/teams";
import { TeamBanner } from "@/components/team-banner";
import { TeamLogo } from "@/components/team-logo";
import { TeamNav } from "@/components/team-nav";
import { Empty, Panel, Section } from "@/components/panels";
import { Save, RotateCcw } from "lucide-react";

export default function TeamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const league = useLeague((s) => s.league);
  const setBranding = useLeague((s) => s.setBranding);

  if (!league) return <Empty>No league yet.</Empty>;
  const baseTeam = TEAMS_BY_ID[id];
  if (!baseTeam) return <Empty>Unknown team.</Empty>;

  const ov = league.brandingOverrides?.[id];
  const isOwner = league.userMode === "Owner" && league.userTeam === id;

  const [city, setCity] = useState(ov?.city ?? baseTeam.city);
  const [name, setName] = useState(ov?.name ?? baseTeam.name);
  const [primary, setPrimary] = useState(ov?.primary ?? baseTeam.primary);
  const [secondary, setSecondary] = useState(ov?.secondary ?? baseTeam.secondary);
  const [stadium, setStadium] = useState(ov?.stadium ?? baseTeam.stadium);
  const [msg, setMsg] = useState<string | null>(null);

  const previewTeam = { ...baseTeam, city, name, primary, secondary, stadium };

  function save() {
    setBranding(id, { city, name, primary, secondary, stadium });
    setMsg("Saved");
    setTimeout(() => setMsg(null), 1500);
  }

  function reset() {
    setCity(baseTeam.city);
    setName(baseTeam.name);
    setPrimary(baseTeam.primary);
    setSecondary(baseTeam.secondary);
    setStadium(baseTeam.stadium);
    setBranding(id, { city: undefined, name: undefined, primary: undefined, secondary: undefined, stadium: undefined });
  }

  return (
    <div className="space-y-4">
      <TeamBanner team={baseTeam} subtitle="Edit franchise branding" />
      <TeamNav teamId={id} />

      {!isOwner && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Branding edits are <strong>Owner-mode only</strong>.
        </div>
      )}

      <Section title="Edit franchise">
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Identity">
            <div className="space-y-2 text-xs">
              <Field label="City" value={city} onChange={setCity} disabled={!isOwner} />
              <Field label="Name" value={name} onChange={setName} disabled={!isOwner} />
              <Field label="Stadium" value={stadium} onChange={setStadium} disabled={!isOwner} />
              <ColorField label="Primary" value={primary} onChange={setPrimary} disabled={!isOwner} />
              <ColorField label="Secondary" value={secondary} onChange={setSecondary} disabled={!isOwner} />
            </div>
            {isOwner && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={save}
                  className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90">
                  <Save size={12} /> Save
                </button>
                <button onClick={reset}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface2">
                  <RotateCcw size={12} /> Reset to defaults
                </button>
                {msg && <span className="text-xs text-emerald-300">{msg}</span>}
              </div>
            )}
          </Panel>
          <Panel title="Live preview">
            <div className="rounded-lg p-4"
              style={{ background: `linear-gradient(135deg, ${primary}55, ${secondary}33), rgb(17 20 27)` }}>
              <div className="flex items-center gap-3">
                <TeamLogo team={previewTeam} size={48} />
                <div>
                  <div className="font-display text-xl font-bold">{city} {name}</div>
                  <div className="text-[11px] text-muted">{stadium}</div>
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              <span className="rounded border border-border bg-bg px-2 py-1">Primary: {primary}</span>
              <span className="rounded border border-border bg-bg px-2 py-1">Secondary: {secondary}</span>
            </div>
          </Panel>
        </div>
      </Section>

      <Link href={`/team/${id}`} className="text-sm text-muted hover:text-fg">
        ← Back to team page
      </Link>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm disabled:opacity-50" />
    </label>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 cursor-pointer rounded border border-border bg-bg disabled:opacity-50" />
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-border bg-bg px-2 py-1 font-mono text-xs disabled:opacity-50" />
    </label>
  );
}
