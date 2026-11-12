import type { ReactNode } from "react";
import { brickPaint, colorHex } from "@/lib/parts";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#e23d2b" />
      <circle cx="11" cy="11" r="3.5" fill="#f0c445" />
      <circle cx="21" cy="11" r="3.5" fill="#f0c445" />
      <circle cx="11" cy="21" r="3.5" fill="#f0c445" />
      <circle cx="21" cy="21" r="3.5" fill="#f0c445" />
    </svg>
  );
}

export function BenchLoading({ label }: { label: string }) {
  return (
    <p className="px-5 py-16 text-center text-muted" role="status">
      {label}…
    </p>
  );
}

export function UnsureBadge({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span
        data-testid="unsure-badge"
        className={
          compact
            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-unsure text-[12px] font-bold leading-none text-white"
            : "inline-flex items-center gap-1 rounded-full bg-unsure-bg px-2 py-0.5 text-xs font-bold text-unsure"
        }
      >
        {compact ? (
          "?"
        ) : (
          <>
            <span
              aria-hidden="true"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-unsure text-[11px] leading-none text-white"
            >
              ?
            </span>
            Unsure
          </>
        )}
      </span>
      <span className="sr-only">{compact ? `Unsure. ${label}` : label}</span>
    </span>
  );
}

export function ColorDot({ color }: { color: string }) {
  const hex = colorHex(color);
  if (!hex) {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 rounded-full border border-dashed border-unsure bg-unsure-bg"
      />
    );
  }
  const paint = brickPaint(color);
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 rounded-full border border-ink/15"
      style={{ background: paint.fill, boxShadow: paint.dark ? `inset 0 0 0 1.5px ${paint.edge}` : undefined }}
    />
  );
}

export function TopBar({
  title,
  backHref,
  backLabel = "Back",
  extra,
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
      {backHref ? (
        <a href={backHref} className="text-sm font-semibold text-brick-dark">
          {backLabel}
        </a>
      ) : (
        <Mark />
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-xl">{title}</h1>
      {extra}
    </header>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max <= 0 ? 0 : Math.min(1, value / max);
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={Math.max(max, 1)}
      aria-valuenow={Math.max(value, 0)}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-brick" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
