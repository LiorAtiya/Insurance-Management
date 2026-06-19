import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      service: 'Insurance Management API',
      version: '1.0.0',
      endpoints: {
        customers: '/customers',
        policies: '/policies',
      },
    };
  }
}
