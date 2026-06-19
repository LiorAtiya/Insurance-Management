import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { PoliciesModule } from './policies/policies.module';

@Module({
  imports: [PrismaModule, CustomersModule, PoliciesModule],
})
export class AppModule {}
