import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' || value === undefined ? undefined : value);

export class StartJobDto {
  @IsOptional()
  @IsBoolean()
  forced?: boolean;
}

export class ImportUrlsDto {
  @IsArray()
  @ArrayMaxSize(40)
  @IsUrl({ require_protocol: true }, { each: true })
  urls!: string[];
}

export class ReviewDto {
  @IsIn(['approve', 'ignore'])
  action!: 'approve' | 'ignore';

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  sportId?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  genderId?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID()
  seasonId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  sizeIds?: string[];

  @IsOptional()
  @IsBoolean()
  importImages?: boolean;

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
}
