import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProductsModule } from './modules/products/products.module';
import { ScrapingModule } from './modules/scraping/scraping.module';
import { TaxonomiesModule } from './modules/taxonomies/taxonomies.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
    PrismaModule,
    AuthModule,
    CatalogModule,
    ProductsModule,
    TaxonomiesModule,
    DashboardModule,
    ScrapingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
