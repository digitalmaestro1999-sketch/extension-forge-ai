import { useCallback, useEffect, useRef, useState } from "react";

export type LogPhase = "read" | "analyze" | "aggregate" | "score" | "done";
export type LogEntry = { t: number; phase: LogPhase; msg: string };

export const LOG_ROW_H = 16;

function phaseColor(phase: LogPhase) {
  return phase === "read" ? "text-sky-400"
    : phase === "analyze" ? "text-emerald-400"
    : phase === "aggregate" ? "text-amber-400"
    : phase === "score" ? "text-fuchsia-400"
    : "text-primary";
}

export function VirtualLogList({ logs, autoStick }: { logs: LogEntry[]; autoStick: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(224);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportH(el.clientHeight || 224);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => setViewportH(el.clientHeight || 224));
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !autoStick || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, autoStick]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < LOG_ROW_H * 2;
  }, []);

  // Safeguards: never render more than MAX_WINDOW rows regardless of viewport
  // size, and guard against non-finite scroll math (jsdom/first paint).
  const MAX_WINDOW = 120;
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const safeViewportH = Number.isFinite(viewportH) && viewportH > 0 ? viewportH : 224;
  const totalH = logs.length * LOG_ROW_H;
  const overscan = 8;
  const rawStart = Math.floor(safeScrollTop / LOG_ROW_H) - overscan;
  const rawEnd = Math.ceil((safeScrollTop + safeViewportH) / LOG_ROW_H) + overscan;
  const start = Math.max(0, Math.min(rawStart, Math.max(0, logs.length - 1)));
  const end = Math.min(logs.length, Math.max(start + 1, Math.min(rawEnd, start + MAX_WINDOW)));
  const slice = logs.slice(start, end);
  const offsetY = start * LOG_ROW_H;


  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      data-testid="virtual-log-list"
      className="mt-2 h-56 overflow-auto rounded-md border border-border bg-black/60 font-mono text-[10.5px] leading-snug"
    >
      <div style={{ height: totalH, position: "relative" }} data-testid="virtual-log-inner">
        <div style={{ position: "absolute", top: offsetY, left: 0, right: 0, padding: "0 8px" }}>
          {slice.map((l, i) => {
            const ts = (l.t / 1000).toFixed(2).padStart(6, " ");
            return (
              <div key={start + i} className="flex gap-2" style={{ height: LOG_ROW_H }} data-testid="log-row">
                <span className="text-muted-foreground">{ts}s</span>
                <span className={`w-16 shrink-0 uppercase ${phaseColor(l.phase)}`}>{l.phase}</span>
                <span className="text-foreground/90 truncate">{l.msg}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
