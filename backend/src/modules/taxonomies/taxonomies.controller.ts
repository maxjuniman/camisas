import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PatchTaxonomyDto, UpsertTaxonomyDto } from './dto/taxonomy.dto';
import { TaxonomiesService, TaxonomyKind } from './taxonomies.service';

@Controller('admin/taxonomies')
@UseGuards(JwtAuthGuard)
export class TaxonomiesController {
  constructor(private readonly taxonomies: TaxonomiesService) {}

  @Get(':kind')
  list(@Param('kind') kind: TaxonomyKind) {
    return this.taxonomies.list(kind);
  }

  @Post(':kind')
  create(@Param('kind') kind: TaxonomyKind, @Body() dto: UpsertTaxonomyDto) {
    return this.taxonomies.create(kind, dto);
  }

  @Patch(':kind/:id')
  update(@Param('kind') kind: TaxonomyKind, @Param('id') id: string, @Body() dto: PatchTaxonomyDto) {
    return this.taxonomies.update(kind, id, dto);
  }

  @Delete(':kind/:id')
  remove(@Param('kind') kind: TaxonomyKind, @Param('id') id: string) {
    return this.taxonomies.remove(kind, id);
  }
}
