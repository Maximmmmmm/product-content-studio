"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { getAdminProduct } from "@/lib/api";
import { useApiResource } from "@/lib/use-api-resource";
import { AdminHeader } from "../../components/admin-header";
import { ErrorNotice } from "../../components/error-notice";
import { StatusBadge } from "../../components/status-badge";
import { ProductEditor } from "./product-editor";

export default function AdminProductPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => getAdminProduct(id), [id]);
  const {
    data: product,
    error,
    retry,
  } = useApiResource(load, "Could not load product.");

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <AdminHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/admin/products"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Back to products
        </Link>

        {error ? <ErrorNotice message={error} onRetry={retry} /> : null}

        {product === null && !error ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Loading product…
          </p>
        ) : null}

        {product ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {product.name}
              </h1>
              <StatusBadge status={product.status} />
            </div>
            <ProductEditor key={product.id} product={product} />
          </>
        ) : null}
      </main>
    </div>
  );
}
