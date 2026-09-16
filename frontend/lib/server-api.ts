import type { PublicProduct, PublicProductListItem } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Never cache: unpublishing must take effect immediately.
const NO_CACHE: RequestInit = { cache: "no-store" };

export async function fetchPublicProducts(): Promise<PublicProductListItem[]> {
  const response = await fetch(`${API_URL}/products`, NO_CACHE);

  if (!response.ok) {
    throw new Error(`Could not load the catalogue (${response.status}).`);
  }

  return (await response.json()) as PublicProductListItem[];
}

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
