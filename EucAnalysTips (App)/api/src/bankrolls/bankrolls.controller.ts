import { Controller, Delete, Get, Param, Patch, Post, Query, Body, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { BankrollsService } from './bankrolls.service';
import { CreateBankrollDto } from './dto/create-bankroll.dto';
import { UpdateBankrollDto } from './dto/update-bankroll.dto';

@Controller('bankrolls')
@UseGuards(JwtAuthGuard)
export class BankrollsController {
  constructor(private readonly bankrollsService: BankrollsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.bankrollsService.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBankrollDto) {
    return this.bankrollsService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBankrollDto) {
    return this.bankrollsService.update(user, id, dto);
  }
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bankrollsService.remove(user, id);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bankrollsService.getById(user, id);
  }

  @Get(':id/stats')
  stats(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sport') sport?: string,
  ) {
    return this.bankrollsService.stats(user, id, { from, to, sport });
  }
}


