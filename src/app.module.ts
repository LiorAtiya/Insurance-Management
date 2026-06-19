import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { PoliciesModule } from './policies/policies.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, CustomersModule, PoliciesModule],
  controllers: [AppController],
})
export class AppModule {}
