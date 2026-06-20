"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "./utils";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Minimal data-fetching hook with loading/error state and manual reload.
 * Pass a `key` (e.g. serialized filters) to refetch when inputs change.
 */
export function useAsyncData<T>(loader: () => Promise<T>, key = "") {
  // Keep the latest loader without making it an effect dependency.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    loaderRef
      .current()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState((s) => ({ data: s.data, loading: false, error: errorMessage(err) })));
  }, []);

  useEffect(() => {
    reload();
  }, [reload, key]);

  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return { ...state, reload, setData };
}
