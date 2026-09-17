"use client";

import { useCallback, useEffect, useState } from "react";
import { fetcher } from "@/lib/fetcher";
import type { PaginatedResult } from "@/lib/types";

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

/**
 * Drives a cursor-paginated admin table against one of this app's own /api/admin/* proxy
 * routes. Whenever `path` or the filter params change, the list resets and refetches page
 * one; `loadMore` appends the next page using the cursor the backend handed back.
 */
export function usePaginatedList<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const paramsKey = JSON.stringify(params);

  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query = buildQuery({ ...JSON.parse(paramsKey), limit: 20 });
    fetcher<PaginatedResult<T>>(`${path}?${query}`)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, paramsKey, reloadToken]);

  const loadMore = useCallback(async () => {
    if (!hasMore || cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const query = buildQuery({ ...JSON.parse(paramsKey), limit: 20, cursor });
      const result = await fetcher<PaginatedResult<T>>(`${path}?${query}`);
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [path, paramsKey, cursor, hasMore, loadingMore]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  return { items, setItems, loading, loadingMore, hasMore, error, loadMore, reload };
}
