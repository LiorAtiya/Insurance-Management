import { Module } from '@nestjs/common';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';
import { PolicyStatusResolver } from './policy-status.resolver';

@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService, PolicyStatusResolver],
})
export class PoliciesModule {}
