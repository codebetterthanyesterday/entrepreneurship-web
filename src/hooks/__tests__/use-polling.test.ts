// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePolling } from "@/hooks/use-polling";

interface Queue {
  tickets: string[];
}

/**
 * SWR caches by key, so every test gets a key of its own — otherwise a later
 * test would open on the previous test's answer.
 *
 * The key has to be computed once and closed over, never inside the render
 * callback: a fresh key on every render is a fresh SWR subscription on every
 * render, which fetches, which renders again.
 */
let keySeq = 0;
const nextKey = () => `/api/kitchen?test=${keySeq++}`;

/**
 * Polls are driven by hand through `refresh()` rather than by the interval:
 * what these tests are about is what happens to `data` when a poll fails, and
 * racing a real timer would only make that flaky.
 */
const NO_BACKGROUND_POLLING = { intervalMs: 10 * 60 * 1000 };

type Scenario =
  | { kind: "ok"; body: Queue }
  | { kind: "http"; status: number }
  | { kind: "offline" };

let scenario: Scenario = { kind: "ok", body: { tickets: [] } };
const fetchMock = vi.fn(async () => {
  // Read once: the `json` closures below run later, and `scenario` is a
  // mutable binding the next test will have already moved on.
  const current = scenario;

  if (current.kind === "offline") throw new TypeError("Failed to fetch");
  if (current.kind === "http") {
    return { ok: false, status: current.status, json: async () => ({}) } as unknown as Response;
  }
  return { ok: true, status: 200, json: async () => current.body } as unknown as Response;
});

beforeEach(() => {
  fetchMock.mockClear();
  scenario = { kind: "ok", body: { tickets: [] } };
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("usePolling", () => {
  it("serves the server-rendered queue before the first poll lands", async () => {
    scenario = { kind: "ok", body: { tickets: ["fresh"] } };

    const fallbackData: Queue = { tickets: ["from-the-server"] };
    const key = nextKey();
    const { result } = renderHook(() =>
      usePolling<Queue>(key, { ...NO_BACKGROUND_POLLING, fallbackData }),
    );

    // Nothing has been fetched yet, but there is already something to draw.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(fallbackData);

    await waitFor(() => expect(result.current.data).toEqual({ tickets: ["fresh"] }));
  });

  it("keeps the last good queue on screen when the connection drops", async () => {
    scenario = { kind: "ok", body: { tickets: ["a", "b"] } };

    const key = nextKey();
    const { result } = renderHook(() => usePolling<Queue>(key, NO_BACKGROUND_POLLING));

    await waitFor(() => expect(result.current.data).toEqual({ tickets: ["a", "b"] }));
    expect(result.current.isError).toBe(false);

    // The venue WiFi flickers.
    scenario = { kind: "offline" };
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // This is the whole point of the hook: a kitchen screen that empties itself
    // because a poll failed is worse than one showing a few seconds of stale
    // data — a cook cannot tell "nothing to make" from "nothing loaded".
    expect(result.current.data).toEqual({ tickets: ["a", "b"] });
    expect(result.current.isLoading).toBe(false);
  });

  it("clears the error once the connection comes back", async () => {
    scenario = { kind: "ok", body: { tickets: ["a"] } };

    const key = nextKey();
    const { result } = renderHook(() => usePolling<Queue>(key, NO_BACKGROUND_POLLING));
    await waitFor(() => expect(result.current.data).toEqual({ tickets: ["a"] }));

    scenario = { kind: "offline" };
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    scenario = { kind: "ok", body: { tickets: ["a", "c"] } };
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.data).toEqual({ tickets: ["a", "c"] });
  });

  it("treats an HTTP error as a failed poll, not as an empty queue", async () => {
    scenario = { kind: "ok", body: { tickets: ["a"] } };

    const key = nextKey();
    const { result } = renderHook(() => usePolling<Queue>(key, NO_BACKGROUND_POLLING));
    await waitFor(() => expect(result.current.data).toEqual({ tickets: ["a"] }));

    // A 500, or a session that expired into a 401, must not read as "no orders".
    for (const status of [500, 401]) {
      scenario = { kind: "http", status };
      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toEqual({ tickets: ["a"] });
    }
  });

  it("reports loading only while there is genuinely nothing to show", async () => {
    const key = nextKey();
    const { result } = renderHook(() => usePolling<Queue>(key, NO_BACKGROUND_POLLING));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ tickets: [] });
  });

  it("asks the endpoint not to serve a cached answer", async () => {
    const key = nextKey();
    renderHook(() => usePolling<Queue>(key, NO_BACKGROUND_POLLING));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(key, { cache: "no-store" });
  });
});
