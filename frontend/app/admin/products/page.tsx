"use client";

import Link from "next/link";
import { useCallback } from "react";
import { listAdminProducts } from "@/lib/api";
import { useApiResource } from "@/lib/use-api-resource";
import { AdminHeader } from "../components/admin-header";
import { ErrorNotice } from "../components/error-notice";
import { StatusBadge } from "../components/status-badge";

export default function AdminProductsPage() {
  const load = useCallback(() => listAdminProducts(), []);
  const {
    data: products,
    error,
    retry,
  } = useApiResource(load, "Could not load products.");

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

        {error ? <ErrorNotice message={error} onRetry={retry} /> : null}

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
