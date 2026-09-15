import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(255)
  email!: string;

  /**
   * Only a presence/length check here. Password *rules* deliberately are not
   * enforced on login: the stored credential was created by the seed, and
   * validating its format at login would leak information about the password
   * policy without adding security.
   */
  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  @MaxLength(200)
  password!: string;
}
