import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductStatus } from './product-status.js';

/** One factual product attribute, as shown on the product page. */
export interface Characteristic {
  label: string;
  value: string;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  status: string;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  characteristics: Characteristic[];
  description: string;
  seoTitle: string;
  seoDescription: string;
  status: string;
  updatedAt: Date;
}

export interface PublicProductListItem {
  slug: string;
  name: string;
  seoDescription: string;
}

export interface PublicProduct {
  slug: string;
  name: string;
  characteristics: Characteristic[];
  description: string;
  seoTitle: string;
  seoDescription: string;
}

/**
 * `characteristics` is stored as JSON text because SQLite has no JSON column
 * type. Parsing is defensive: a malformed value yields an empty list so the
 * product page still renders, rather than turning a display concern into a 500.
 */
function parseCharacteristics(raw: string): Characteristic[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is Characteristic =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Characteristic).label === 'string' &&
        typeof (entry as Characteristic).value === 'string',
    );
  } catch {
    return [];
  }
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin list: only what the list screen shows. */
  findAllForAdmin(): Promise<AdminProductListItem[]> {
    return this.prisma.product.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOneForAdmin(id: string): Promise<AdminProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        characteristics: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return {
      ...product,
      characteristics: parseCharacteristics(product.characteristics),
    };
  }

  /**
   * Applies an administrator's edits.
   *
   * Only the DTO's four fields are written. `name`, `characteristics`, `slug`
   * and `id` are never part of the update payload, so they cannot be changed
   * through this endpoint even if a request tries.
   */
  async update(id: string, dto: UpdateProductDto): Promise<AdminProduct> {
    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          description: dto.description,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          status: dto.status,
        },
      });
    } catch (error) {
      // P2025 = "record to update not found".
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Product not found.');
      }
      throw error;
    }

    return this.findOneForAdmin(id);
  }

  /**
   * Public catalogue.
   *
   * The published filter is part of the database query, not a filter applied
   * afterwards in JavaScript — a draft is never loaded, so it cannot leak
   * through a later refactor of the response shape.
   */
  findPublished(): Promise<PublicProductListItem[]> {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.Published },
      select: { slug: true, name: true, seoDescription: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Public product page.
   *
   * A draft and a genuinely unknown slug are both answered with 404 — never
   * 403 — so the public API does not reveal that a draft with that slug exists.
   */
  async findPublishedBySlug(slug: string): Promise<PublicProduct> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.Published },
      select: {
        slug: true,
        name: true,
        characteristics: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return {
      ...product,
      characteristics: parseCharacteristics(product.characteristics),
    };
  }
}
