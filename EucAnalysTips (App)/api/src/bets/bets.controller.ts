import { Body, Controller, Get, Patch, Post, Query, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { BetsService } from './bets.service';
import { CreateBetDto } from './dto/create-bet.dto';
import { ListBetsQueryDto } from './dto/list-bets-query.dto';
import { UpdateBetDto } from './dto/update-bet.dto';

@Controller('bets')
@UseGuards(JwtAuthGuard)
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBetDto) {
    return this.betsService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBetDto) {
    return this.betsService.update(user, id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBetsQueryDto) {
    return this.betsService.list(user, query);
  }
}
