"use client";

import useSWR, { type KeyedMutator } from "swr";

/** Five seconds: the guide's target is a new order on the board within ten. */
const DEFAULT_INTERVAL_MS = 5_000;

export interface PollingResult<T> {
  /**
   * The last data that arrived successfully. This does **not** go back to
   * undefined when a poll fails — see `isError`.
   */
  data: T | undefined;
  /** No data has ever arrived; there is genuinely nothing to draw yet. */
  isLoading: boolean;
  /** The most recent poll failed. Whatever is in `data` is still on screen. */
  isError: boolean;
  /** Forces a poll now, without waiting for the interval. */
  refresh: () => void;
  /**
   * SWR's mutator, for a caller that wants to show the result of an action
   * before the server has confirmed it. Pass `optimisticData` with
   * `rollbackOnError` and the screen snaps back by itself if the action fails.
   */
  mutate: KeyedMutator<T>;
}

export interface PollingOptions<T> {
  /** Rendered on the very first paint, before the first poll returns. */
  fallbackData?: T;
  intervalMs?: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Polls a JSON endpoint on an interval and keeps showing the last good answer
 * when a poll fails.
 *
 * That last part is the whole point. A kitchen screen that blanks itself
 * because the venue WiFi flickered is far more dangerous than one showing data
 * a few seconds old: the orders do not stop existing, and a cook staring at an
 * empty board has no way to tell "nothing to make" from "nothing loaded". So
 * failure is reported as a flag alongside the data the screen already has,
 * never by clearing it. SWR keeps the previous value on a failed revalidation,
 * and `keepPreviousData` extends the same courtesy across a key change.
 */
export function usePolling<T>(url: string, options: PollingOptions<T> = {}): PollingResult<T> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  const { data, error, isLoading, mutate } = useSWR<T>(url, fetchJson<T>, {
    refreshInterval: intervalMs,
    keepPreviousData: true,
    revalidateOnFocus: true,
    fallbackData: options.fallbackData,

    // SWR skips its refresh tick while the cache is holding an error, so the
    // retry is not an optimisation here — it is the only thing that keeps the
    // screen trying. Without it one failed poll parks the board on "connection
    // lost" until somebody refocuses the tab, and a screen propped up on a
    // shelf in a kitchen never gets refocused.
    shouldRetryOnError: true,

    // A steady retry at the polling interval, replacing SWR's exponential
    // backoff: a board that has fallen behind should come back as soon as the
    // connection does, not after a backoff window that grows all service.
    onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
      setTimeout(() => revalidate({ retryCount }), intervalMs);
    },
  });

  return {
    data,
    // `fallbackData` counts as something to draw, so the board rendered on the
    // server is never treated as "still loading".
    isLoading: isLoading && data === undefined,
    isError: error !== undefined,
    refresh: () => {
      void mutate();
    },
    mutate,
  };
}
