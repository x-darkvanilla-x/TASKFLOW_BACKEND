import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const isDbConnected = this.connection.readyState === 1;
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      database: isDbConnected ? 'connected' : 'connecting',
      timestamp: new Date().toISOString(),
      service: 'Follow Up API',
    };
  }
}

