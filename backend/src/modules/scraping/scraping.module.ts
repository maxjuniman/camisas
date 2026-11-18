import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ScrapingController } from './scraping.controller';
import { ScrapingService } from './scraping.service';

@Module({
  imports: [MediaModule],
  controllers: [ScrapingController],
  providers: [ScrapingService],
})
export class ScrapingModule {}
