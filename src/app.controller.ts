import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('heavy')
  async getHeavy() {
    const result = await this.appService.heavyComputation()
    console.log('result', result)

    return {
      data: 'ok'
    }
  }
}
