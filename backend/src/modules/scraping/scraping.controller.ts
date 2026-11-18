import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportUrlsDto, ReviewDto, StartJobDto } from './dto/scraping.dto';
import { ScrapingService } from './scraping.service';

type AuthRequest = Request & { user: { id: string } };

@Controller('admin/scraping')
@UseGuards(JwtAuthGuard)
export class ScrapingController {
  constructor(private readonly scraping: ScrapingService) {}

  @Get('source')
  source() {
    return { url: this.scraping.categoryUrl() };
  }

  @Get('jobs')
  jobs() {
    return this.scraping.listJobs();
  }

  @Get('jobs/:id')
  job(@Param('id') id: string) {
    return this.scraping.getJob(id);
  }

  @Get('items')
  items(@Query('reviewStatus') reviewStatus?: string) {
    return this.scraping.listItems(reviewStatus);
  }

  @Get('items/:id')
  item(@Param('id') id: string) {
    return this.scraping.getItem(id);
  }

  @Post('jobs')
  @Throttle({ default: { limit: 6, ttl: 600000 } })
  start(@Body() dto: StartJobDto, @Req() request: AuthRequest) {
    return this.scraping.start(Boolean(dto.forced), request.user.id);
  }

  @Post('jobs/:id/pause')
  pause(@Param('id') id: string) {
    return this.scraping.pause(id);
  }

  @Post('jobs/:id/resume')
  resume(@Param('id') id: string) {
    return this.scraping.resume(id);
  }

  @Post('reset')
  reset() {
    return this.scraping.reset();
  }

  @Post('import')
  importUrls(@Body() dto: ImportUrlsDto, @Req() request: AuthRequest) {
    return this.scraping.importUrls(dto, request.user.id);
  }

  @Post('items/:id/review')
  review(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.scraping.review(id, dto);
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.scraping.removeItem(id);
  }
}
