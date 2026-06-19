import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PolicyStatusResolver } from './policy-status.resolver';
import { IssuePolicyDto } from './dto/issue-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { QueryPoliciesDto } from './dto/query-policies.dto';
import { PolicyStatus } from '../common/enums/policy-status.enum';
import { Policy, Prisma, PolicyStatus as PrismaStatus } from '@prisma/client';

type PolicyWithComputedStatus = Policy & { computedStatus: PolicyStatus };

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusResolver: PolicyStatusResolver,
  ) {}

  async issue(customerId: string, dto: IssuePolicyDto): Promise<PolicyWithComputedStatus> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || !customer.isActive) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const policyNumber = await this.generatePolicyNumber();

    const policy = await this.prisma.policy.create({
      data: {
        policyNumber,
        type: dto.type,
        premium: dto.premium,
        startDate: start,
        endDate: end,
        customerId,
      },
    });

    return { ...policy, computedStatus: this.statusResolver.resolve(policy) };
  }

  async findAll(query: QueryPoliciesDto): Promise<PolicyWithComputedStatus[]> {
    const where: Prisma.PolicyWhereInput = {};

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.type) {
      where.type = query.type;
    }

    const policies = await this.prisma.policy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const resolved = this.statusResolver.resolveMany(policies);

    if (query.status) {
      return resolved.filter((p) => p.computedStatus === query.status);
    }

    return resolved;
  }

  async findOne(id: string): Promise<PolicyWithComputedStatus> {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Policy ${id} not found`);
    }
    return { ...policy, computedStatus: this.statusResolver.resolve(policy) };
  }

  async update(id: string, dto: UpdatePolicyDto): Promise<PolicyWithComputedStatus> {
    const existing = await this.findOne(id);

    if (existing.computedStatus !== PolicyStatus.ACTIVE) {
      throw new ConflictException(
        `Cannot update a policy with status ${existing.computedStatus}`,
      );
    }

    if (dto.startDate || dto.endDate) {
      const start = dto.startDate ? new Date(dto.startDate) : existing.startDate;
      const end = dto.endDate ? new Date(dto.endDate) : existing.endDate;
      if (end <= start) {
        throw new BadRequestException('endDate must be after startDate');
      }
    }

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        ...(dto.premium !== undefined && { premium: dto.premium }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      },
    });

    return { ...updated, computedStatus: this.statusResolver.resolve(updated) };
  }

  async cancel(id: string): Promise<PolicyWithComputedStatus> {
    const existing = await this.findOne(id);

    if (existing.computedStatus !== PolicyStatus.ACTIVE) {
      throw new ConflictException(
        `Cannot cancel a policy with status ${existing.computedStatus}. Only ACTIVE policies can be cancelled.`,
      );
    }

    const cancelled = await this.prisma.policy.update({
      where: { id },
      data: {
        status: PrismaStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    return { ...cancelled, computedStatus: PolicyStatus.CANCELLED };
  }

  private async generatePolicyNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `POL-${year}-`;

    const last = await this.prisma.policy.findFirst({
      where: { policyNumber: { startsWith: prefix } },
      orderBy: { policyNumber: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parts = last.policyNumber.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }
}
