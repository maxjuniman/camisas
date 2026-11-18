import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

export class UpsertTaxonomyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  sportId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  countryId?: string | null;
}

export class PatchTaxonomyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  sportId?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  countryId?: string | null;
}
