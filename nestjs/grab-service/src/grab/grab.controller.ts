import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { GrabService } from './grab.service';

@Controller('grab')
export class GrabController {
  constructor(private readonly grabService: GrabService) {}

  @Post('ticket')
  async grabTicket(
    @Body() body: { userId: string; sessionId: string; ticketTypeId: string },
  ) {
    const result = await this.grabService.grabTicket(
      body.userId,
      body.sessionId,
      body.ticketTypeId,
    );
    return result;
  }

  @Post('init-stock')
  async initStock(
    @Body() body: { sessionId: string; ticketTypeId: string; stock: number },
  ) {
    await this.grabService.initStock(body.sessionId, body.ticketTypeId, body.stock);
    return { success: true, message: '库存初始化成功' };
  }

  @Get('stock')
  async getStock(
    @Query('sessionId') sessionId: string,
    @Query('ticketTypeId') ticketTypeId: string,
  ) {
    const stock = await this.grabService.getStock(sessionId, ticketTypeId);
    return { stock };
  }
}