import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicLeaderboardQueryDto } from './dto/public-leaderboard-query.dto';
import { PublicWidgetQueryDto } from './dto/public-widget-query.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('leaderboard')
  leaderboard(@Query() query: PublicLeaderboardQueryDto) {
    return this.publicService.leaderboard(query);
  }

  @Get('trainers')
  trainers() {
    return this.publicService.trainers();
  }

  @Get('trainers/:slug/performance')
  trainerPerformance(@Param('slug') slug: string, @Query() query: PublicLeaderboardQueryDto) {
    return this.publicService.trainerPerformance(slug, query);
  }

  @Get('widgets/:widgetKey/data')
  widgetData(@Param('widgetKey') widgetKey: string, @Query() query: PublicWidgetQueryDto) {
    return this.publicService.widgetData(widgetKey, query);
  }

  @Get('widgets/:widgetKey/embed')
  @Header('Content-Type', 'text/html; charset=utf-8')
  widgetEmbed(@Param('widgetKey') widgetKey: string, @Query() query: PublicWidgetQueryDto) {
    return this.publicService.widgetEmbedHtml(widgetKey, query);
  }
}
