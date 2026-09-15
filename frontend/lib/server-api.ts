import type { PublicProduct, PublicProductListItem } from "./api";

/**
 * Server-side client for the public API.
 *
 * Deliberately separate from `lib/api.ts`: that module is the browser client
 * and sends `credentials: 'include'`, which is meaningless here. These calls
 * run in Next's server runtime, carry no cookie, and therefore can only ever
 * see what an anonymous visitor sees — the published products.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Public data is never cached by this app.
 *
 * Publishing or unpublishing a product must take effect immediately, so a
 * cached catalogue could keep showing a product the manager has just
 * unpublished — the exact leak the assignment's draft rule is about.
 */
const NO_CACHE: RequestInit = { cache: "no-store" };

export async function fetchPublicProducts(): Promise<PublicProductListItem[]> {
  const response = await fetch(`${API_URL}/products`, NO_CACHE);

  if (!response.ok) {
    throw new Error(`Could not load the catalogue (${response.status}).`);
  }

  return (await response.json()) as PublicProductListItem[];
}

/**
 * Returns `null` when the product is not publicly available.
 *
 * The API answers 404 for both an unknown slug and a draft, so this function
 * cannot tell them apart either — which is the point. The caller renders the
 * same "not found" page for both.
 */
export async function fetchPublicProduct(
  slug: string,
): Promise<PublicProduct | null> {
  const response = await fetch(
    `${API_URL}/products/${encodeURIComponent(slug)}`,
    NO_CACHE,
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Could not load the product (${response.status}).`);
  }

  return (await response.json()) as PublicProduct;
}
