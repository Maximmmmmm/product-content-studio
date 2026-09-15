"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  listAdminProducts,
  type AdminProductListItem,
} from "@/lib/api";
import { AdminHeader } from "../components/admin-header";
import { StatusBadge } from "../components/status-badge";

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProductListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Incremented by "Try again" to re-run the effect below.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Guards against a slow response resolving after the user has navigated
    // away, which would set state on an unmounted component.
    let cancelled = false;

    async function load() {
      try {
        const loaded = await listAdminProducts();
        if (cancelled) return;
        setProducts(loaded);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        // The server is what enforces access; the UI simply reacts to being
        // told it is not authenticated.
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/admin/login");
          return;
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Could not load products.",
        );
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router, reloadToken]);

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <AdminHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Products
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Select a product to edit its description and SEO fields.
        </p>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-2 font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : null}

        {products === null && !error ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Loading products…
          </p>
        ) : null}

        {products ? (
          <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 transition-colors hover:bg-zinc-50 sm:px-6 dark:hover:bg-zinc-800/50"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {product.name}
                  </span>
                  <StatusBadge status={product.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
