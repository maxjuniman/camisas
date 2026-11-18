import { Controller, Get, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CatalogService } from './catalog.service';

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  teams?: string;

  @IsOptional()
  @IsString()
  sports?: string;

  @IsOptional()
  @IsString()
  genders?: string;

  @IsOptional()
  @IsString()
  categories?: string;

  @IsOptional()
  @IsString()
  sizes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'newest', 'name'])
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('home')
  home() {
    return this.catalog.home();
  }

  @Get('filters')
  filters() {
    return this.catalog.filters();
  }

  @Get('products')
  list(@Query() query: CatalogQueryDto) {
    return this.catalog.list(query);
  }

  @Get('products/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.catalog.bySlug(slug);
  }
}
