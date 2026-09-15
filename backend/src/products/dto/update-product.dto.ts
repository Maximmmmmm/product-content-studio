import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PRODUCT_STATUSES, ProductStatus } from '../product-status.js';

/**
 * Trims surrounding whitespace before validation runs.
 *
 * Without this, a description of "   " would satisfy a non-empty check while
 * being empty to a reader, and trailing whitespace would count towards the
 * length limits. Trimming first means the value that is validated is exactly
 * the value that gets stored.
 */
const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * The only fields an administrator may change.
 *
 * `name`, `characteristics`, `id` and `slug` are deliberately absent: combined
 * with the global ValidationPipe's `forbidNonWhitelisted`, sending any of them
 * is rejected with 400 rather than silently ignored. That is what stops a
 * direct API request from editing read-only product data.
 *
 * All four fields are required. The editor saves the whole form in one explicit
 * action, so every save re-validates every field — there is no path that writes
 * a product without checking all of the assignment's limits.
 */
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
