import { cn } from "@/lib/utils";

export function Panel({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          {title && <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">{title}</h3>}
          {action}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface2 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums text-fg">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <header className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}
