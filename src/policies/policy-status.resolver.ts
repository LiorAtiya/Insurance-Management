import { Injectable } from '@nestjs/common';
import { Policy, PolicyStatus as PrismaStatus } from '@prisma/client';
import { PolicyStatus } from '../common/enums/policy-status.enum';

@Injectable()
export class PolicyStatusResolver {
  resolve(policy: Policy): PolicyStatus {
    if (policy.status === PrismaStatus.CANCELLED) {
      return PolicyStatus.CANCELLED;
    }
    if (new Date() > policy.endDate) {
      return PolicyStatus.EXPIRED;
    }
    return PolicyStatus.ACTIVE;
  }

  resolveMany(policies: Policy[]): (Policy & { computedStatus: PolicyStatus })[] {
    return policies.map((p) => ({ ...p, computedStatus: this.resolve(p) }));
  }
}
