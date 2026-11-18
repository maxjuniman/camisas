import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async summary() {
    const [total, active, inactive, pendingProducts, pendingScraped, lastJob] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { isActive: false } }),
      this.prisma.product.count({ where: { status: 'PENDING' } }),
      this.prisma.scrapedProduct.count({ where: { reviewStatus: 'PENDING' } }),
      this.prisma.scrapingJob.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      total,
      active,
      inactive,
      pendingApproval: pendingProducts + pendingScraped,
      lastScanFound: lastJob?.foundCount ?? 0,
      lastScanAt: lastJob?.finishedAt ?? lastJob?.startedAt ?? null,
      lastScanNew: lastJob?.newCount ?? 0,
      lastScanStatus: lastJob?.status ?? null,
    };
  }
}
