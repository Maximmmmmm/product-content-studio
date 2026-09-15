/**
 * The two states a product card can be in.
 *
 * This is a plain constant rather than a Prisma enum because the SQLite
 * connector does not support enums, so `Product.status` is a String column.
 * That makes this file the single source of truth for the allowed values:
 * the update DTO validates against it, and the services query with it.
 */
export const PRODUCT_STATUSES = ['draft', 'published'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ProductStatus = {
  Draft: 'draft',
  Published: 'published',
} as const satisfies Record<string, ProductStatus>;
