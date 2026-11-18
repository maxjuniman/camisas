import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminProductQueryDto, PatchFlagsDto, UpsertProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: AdminProductQueryDto) {
    return this.products.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }

  @Post()
  create(@Body() dto: UpsertProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.products.update(id, dto);
  }

  @Patch(':id/flags')
  patchFlags(@Param('id') id: string, @Body() dto: PatchFlagsDto) {
    return this.products.patchFlags(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  addImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.products.addImages(id, files);
  }

  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.products.removeImage(id, imageId);
  }

  @Patch(':id/images/:imageId/primary')
  makePrimary(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.products.makePrimary(id, imageId);
  }
}
