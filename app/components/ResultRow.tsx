import type { CheckResult, Status } from "@/lib/types";

const STATUS_STYLES: Record<
  Status,
  { dot: string; chip: string; label: string }
> = {
  available: {
    dot: "bg-green-500",
    chip: "bg-green-950 text-green-300 border-green-700",
    label: "Available",
  },
  taken: {
    dot: "bg-red-500",
    chip: "bg-red-950 text-red-300 border-red-700",
    label: "Taken",
  },
  unknown: {
    dot: "bg-neutral-500",
    chip: "bg-neutral-900 text-neutral-300 border-neutral-700",
    label: "Unknown",
  },
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 sm:py-3">
      {children}
    </li>
  );
}

/** Loading placeholder shown per platform while checks are in flight. */
export function LoadingRow({ name }: { name: string }) {
  return (
    <Row>
      <span
        className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-neutral-600"
        aria-hidden
      />
      <span className="font-medium text-neutral-200">{name}</span>
      <span className="ml-auto flex items-center gap-2 text-sm text-neutral-500">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-400"
          aria-hidden
        />
        <span>Checking…</span>
      </span>
    </Row>
  );
}

export function ResultRow({ result }: { result: CheckResult }) {
  const style = STATUS_STYLES[result.status];
  const showOpenLink = result.status === "unknown";

  return (
    <Row>
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${style.dot}`}
        aria-hidden
      />
      <div className="min-w-0">
        <span className="font-medium text-neutral-100">{result.platform}</span>
        <span className="block truncate text-xs text-neutral-500">
          {result.checkedVia}
          {result.reason ? ` · ${result.reason}` : ""}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {showOpenLink && (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2 py-1 text-sm font-medium text-sky-400 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            Open&nbsp;↗
          </a>
        )}
        <span
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${style.chip}`}
          aria-label={`${result.platform}: ${style.label}`}
        >
          {style.label}
        </span>
      </div>
    </Row>
  );
}
