import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PRODUCT_STATUSES, ProductStatus } from '../product-status.js';

// Trimmed before validation, so "   " fails the non-empty check and
// whitespace does not count towards the limits.
const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Read-only fields are absent on purpose: with forbidNonWhitelisted, sending
// name/slug/id is rejected rather than silently ignored.
export class UpdateProductDto {
  @Transform(trim)
  @IsString({ message: 'Description is required.' })
  @MinLength(1, { message: 'Description must not be empty.' })
  @MaxLength(1000, {
    message: 'Description must be 1000 characters or fewer.',
  })
  description!: string;

  @Transform(trim)
  @IsString({ message: 'SEO title is required.' })
  @MinLength(1, { message: 'SEO title must not be empty.' })
  @MaxLength(60, { message: 'SEO title must be 60 characters or fewer.' })
  seoTitle!: string;

  @Transform(trim)
  @IsString({ message: 'SEO description is required.' })
  @MinLength(1, { message: 'SEO description must not be empty.' })
  @MaxLength(160, {
    message: 'SEO description must be 160 characters or fewer.',
  })
  seoDescription!: string;

  @IsIn(PRODUCT_STATUSES, {
    message: `Status must be one of: ${PRODUCT_STATUSES.join(', ')}.`,
  })
  status!: ProductStatus;
}
