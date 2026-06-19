import { PolicyStatus } from '../../common/enums/policy-status.enum';
import { PolicyType } from '../../common/enums/policy-type.enum';

export class PolicyEntity {
  id: string;
  policyNumber: string;
  type: PolicyType;
  status: PolicyStatus;
  premium: number;
  startDate: Date;
  endDate: Date;
  cancelledAt: Date | null;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}
