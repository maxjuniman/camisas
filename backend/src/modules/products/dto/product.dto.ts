import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : value);

export class UpsertProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  sportId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  countryId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  genderId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  seasonId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  sizeIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isLaunch?: boolean;

  @IsOptional()
  @IsString()
  availabilityNote?: string;

  @IsOptional()
  @IsString()
  orderNote?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class PatchFlagsDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  availableForOrder?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;
}

export class AdminProductQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  sportId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;
}
