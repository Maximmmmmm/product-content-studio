"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "./api";

interface ApiResource<T> {
  data: T | null;
  error: string | null;
  retry: () => void;
}

export function useApiResource<T>(
  load: () => Promise<T>,
  fallbackMessage: string,
): ApiResource<T> {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await load();
        if (cancelled) return;
        setData(loaded);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/admin/login");
          return;
        }
        setError(caught instanceof ApiError ? caught.message : fallbackMessage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, reloadToken, load, fallbackMessage]);

  return {
    data,
    error,
    retry: () => setReloadToken((token) => token + 1),
  };
}
