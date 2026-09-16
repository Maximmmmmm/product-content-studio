import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductStatus } from './product-status.js';

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
      // P2025 = record to update not found.
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

  findPublished(): Promise<PublicProductListItem[]> {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.Published },
      select: { slug: true, name: true, seoDescription: true },
      orderBy: { name: 'asc' },
    });
  }

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

    // 404 rather than 403: a 403 would confirm a draft exists at this slug.
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return {
      ...product,
      characteristics: parseCharacteristics(product.characteristics),
    };
  }
}
