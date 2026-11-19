import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApprovePendingDto, ImportUrlsDto, ReviewDto, SaveLinkDto, StartJobDto } from './dto/scraping.dto';
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

  @Get('links')
  links() {
    return this.scraping.listLinks();
  }

  @Post('links')
  createLink(@Body() dto: SaveLinkDto) {
    return this.scraping.createLink(dto);
  }

  @Patch('links/:id')
  updateLink(@Param('id') id: string, @Body() dto: SaveLinkDto) {
    return this.scraping.updateLink(id, dto);
  }

  @Delete('links/:id')
  removeLink(@Param('id') id: string) {
    return this.scraping.removeLink(id);
  }

  @Get('jobs')
  jobs() {
    return this.scraping.listJobs();
  }

  @Get('jobs/:id/issues')
  issues(@Param('id') id: string) {
    return this.scraping.listIssues(id);
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

  @Get('approvals')
  approvals() {
    return this.scraping.listApprovals();
  }

  @Post('approve')
  approvePending(@Body() dto: ApprovePendingDto) {
    return this.scraping.approveWithoutReview(dto.price ?? 0);
  }

  @Post('import')
  importUrls(@Body() dto: ImportUrlsDto, @Req() request: AuthRequest) {
    return this.scraping.importUrls(dto, request.user.id);
  }

  @Post('items/:id/review')
  review(@Param('id') id: string, @Body() dto: ReviewDto) {
    return this.scraping.review(id, dto);
  }

  @Post('items/:id/discontinue')
  discontinue(@Param('id') id: string) {
    return this.scraping.confirmDiscontinued(id);
  }

  @Post('items/:id/release')
  release(@Param('id') id: string) {
    return this.scraping.releaseDuplicate(id);
  }

  @Post('items/:id/import')
  importAnyway(@Param('id') id: string, @Body() dto: ApprovePendingDto) {
    return this.scraping.importAnyway(id, dto.price ?? 0);
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.scraping.removeItem(id);
  }
}
