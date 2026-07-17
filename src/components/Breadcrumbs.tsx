"use client";

export interface Crumb {
  label: string;
  onClick: () => void;
}

export default function Breadcrumbs({ items, current }: { items: Crumb[]; current?: string }) {
  if (items.length === 0 && !current) return null;
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted/50">/</span>}
          <button onClick={item.onClick} className="hover:text-accent hover:underline">
            {item.label}
          </button>
        </span>
      ))}
      {current && (
        <span className="flex items-center gap-1.5">
          {items.length > 0 && <span className="text-muted/50">/</span>}
          <span className="text-foreground">{current}</span>
        </span>
      )}
    </nav>
  );
}
