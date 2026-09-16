import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { fetchPublicProduct } from "@/lib/server-api";

const getProduct = cache(fetchPublicProduct);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.seoTitle,
    description: product.seoDescription,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Product Catalogue
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Back to catalogue
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {product.name}
        </h1>

        {/* Rendered as a React text node. React escapes text children, so
            stored content is displayed, never executed as markup. There is no
            `dangerouslySetInnerHTML` anywhere in this project, and the
            `react/no-danger` ESLint rule keeps it that way. */}
        <p className="mt-5 leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
          {product.description}
        </p>

        {product.characteristics.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Specifications
            </h2>
            <dl className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {product.characteristics.map((characteristic) => (
                <div
                  key={characteristic.label}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm sm:px-5"
                >
                  <dt className="text-zinc-500 dark:text-zinc-400">
                    {characteristic.label}
                  </dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                    {characteristic.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </main>
    </div>
  );
}
