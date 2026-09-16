export const PRODUCT_STATUSES = ['draft', 'published'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ProductStatus = {
  Draft: 'draft',
  Published: 'published',
} as const satisfies Record<string, ProductStatus>;
