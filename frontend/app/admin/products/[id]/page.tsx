"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getAdminProduct, type AdminProduct } from "@/lib/api";
import { AdminHeader } from "../../components/admin-header";
import { StatusBadge } from "../../components/status-badge";
import { ProductEditor } from "./product-editor";

export default function AdminProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Incremented by "Try again" to re-run the effect below.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // Guards against a slow response resolving after the user has navigated
    // away, which would set state on an unmounted component.
    let cancelled = false;

    async function load() {
      try {
        const loaded = await getAdminProduct(id);
        if (cancelled) return;
        setProduct(loaded);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/admin/login");
          return;
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Could not load product.",
        );
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, router, reloadToken]);

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

            {/* `key` ties the form state to the product, so navigating between
                products cannot carry one product's edits into another. */}
            <ProductEditor key={product.id} product={product} />
          </>
        ) : null}
      </main>
    </div>
  );
}
