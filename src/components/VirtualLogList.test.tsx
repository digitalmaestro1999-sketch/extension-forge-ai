import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { VirtualLogList, LOG_ROW_H, type LogEntry } from "./VirtualLogList";

function makeLogs(n: number, offset = 0): LogEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    t: (offset + i) * 10,
    phase: "analyze" as const,
    msg: `file-${offset + i}.ts`,
  }));
}

// jsdom doesn't lay out elements; stub scrollHeight/clientHeight so the
// virtualizer & auto-scroll logic have realistic numbers to work with.
function stubBox(el: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
}

describe("VirtualLogList", () => {
  beforeEach(() => {
    // ResizeObserver isn't in jsdom
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class { observe() {} disconnect() {} unobserve() {} };
  });

  it("virtualizes: only a small window of rows is rendered for large logs", () => {
    const logs = makeLogs(5000);
    render(<VirtualLogList logs={logs} autoStick={false} />);
    const rows = screen.getAllByTestId("log-row");
    // Should be far fewer than total (window ~ viewport/row + overscan).
    expect(rows.length).toBeLessThan(200);
    expect(rows.length).toBeGreaterThan(0);
    // Full virtual height reserved for scrollbar accuracy.
    const inner = screen.getByTestId("virtual-log-inner");
    expect(inner.style.height).toBe(`${5000 * LOG_ROW_H}px`);
  });

  it("auto-scrolls to bottom when stuck and new logs arrive", () => {
    const initial = makeLogs(50);
    const { rerender } = render(<VirtualLogList logs={initial} autoStick={true} />);
    const container = screen.getByTestId("virtual-log-list");
    stubBox(container, 224, 50 * LOG_ROW_H);

    // Grow logs — auto-scroll should snap to bottom.
    const grown = [...initial, ...makeLogs(150, 50)];
    stubBox(container, 224, 200 * LOG_ROW_H);
    act(() => { rerender(<VirtualLogList logs={grown} autoStick={true} />); });

    expect(container.scrollTop).toBe(container.scrollHeight);
  });

  it("does NOT auto-scroll when the user has scrolled up (unstuck)", () => {
    const initial = makeLogs(200);
    const { rerender } = render(<VirtualLogList logs={initial} autoStick={true} />);
    const container = screen.getByTestId("virtual-log-list");
    stubBox(container, 224, 200 * LOG_ROW_H);

    // Simulate user scrolling far from the bottom.
    container.scrollTop = 100;
    act(() => { container.dispatchEvent(new Event("scroll", { bubbles: true })); });

    const grown = [...initial, ...makeLogs(50, 200)];
    stubBox(container, 224, 250 * LOG_ROW_H);
    act(() => { rerender(<VirtualLogList logs={grown} autoStick={true} />); });

    // Stayed put — did not snap to bottom.
    expect(container.scrollTop).toBe(100);
  });

  it("re-sticks to bottom after the user scrolls back down", () => {
    const initial = makeLogs(200);
    const { rerender } = render(<VirtualLogList logs={initial} autoStick={true} />);
    const container = screen.getByTestId("virtual-log-list");
    stubBox(container, 224, 200 * LOG_ROW_H);

    // Scroll up (unstuck)
    container.scrollTop = 100;
    act(() => { container.dispatchEvent(new Event("scroll", { bubbles: true })); });

    // Scroll back near bottom (re-stuck)
    container.scrollTop = container.scrollHeight - container.clientHeight;
    act(() => { container.dispatchEvent(new Event("scroll", { bubbles: true })); });

    const grown = [...initial, ...makeLogs(50, 200)];
    stubBox(container, 224, 250 * LOG_ROW_H);
    act(() => { rerender(<VirtualLogList logs={grown} autoStick={true} />); });

    expect(container.scrollTop).toBe(container.scrollHeight);
  });
});
