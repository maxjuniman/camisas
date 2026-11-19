import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  Max,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : value);
const blankToUndefined = ({ value }: { value: unknown }) => (value === '' || value === null || value === undefined ? undefined : value);

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
  @Transform(blankToUndefined)
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  sportId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  national?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsIn(['recent', 'oldest', 'name', 'name-desc', 'price', 'price-desc'])
  sort?: 'recent' | 'oldest' | 'name' | 'name-desc' | 'price' | 'price-desc';
}

export class BulkEditDto {
  @IsIn(['ids', 'filter'])
  scope!: 'ids' | 'filter';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids?: string[];

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  filterTeamId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  filterSportId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  filterCountryId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  filterCategoryId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  national?: boolean;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  sportId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  translateNames?: boolean;
}

export class ReorderImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  imageIds!: string[];
}
