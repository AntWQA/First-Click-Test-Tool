import { useEffect, useRef, useState } from "react";
import { SearchError, type SearchFailure } from "./types";

export type AsyncState<T> =
  | { status: "loading"; data: T | null }
  | { status: "ready"; data: T }
  | { status: "failed"; kind: SearchFailure; data: T | null };

/** Runs an async search whenever `key` changes; stale responses are ignored. `retry` re-runs the last request. */
export function useAsync<T>(run: () => Promise<T>, key: string, enabled = true) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled) return;
    const id = ++latest.current;
    setState((s) => ({ status: "loading", data: s.data }));
    runRef.current().then(
      (data) => { if (id === latest.current) setState({ status: "ready", data }); },
      (e: unknown) => { if (id === latest.current) setState((s) => ({ status: "failed", kind: e instanceof SearchError ? e.kind : "error", data: s.data })); },
    );
  }, [key, attempt, enabled]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
