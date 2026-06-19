import { PolicyStatusResolver } from './policy-status.resolver';
import { PolicyStatus } from '../common/enums/policy-status.enum';
import { Policy, PolicyStatus as PrismaStatus, PolicyType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const makePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-id',
  policyNumber: 'POL-2026-00001',
  type: PolicyType.CAR,
  status: PrismaStatus.ACTIVE,
  premium: new Decimal(300),
  startDate: new Date('2026-01-01'),
  endDate: new Date('2027-01-01'),
  cancelledAt: null,
  customerId: 'customer-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('PolicyStatusResolver', () => {
  let resolver: PolicyStatusResolver;

  beforeEach(() => {
    resolver = new PolicyStatusResolver();
  });

  describe('resolve', () => {
    // Functional
    it('returns ACTIVE when status=ACTIVE and endDate is in the future', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
      const result = resolver.resolve(makePolicy({ endDate: future }));
      expect(result).toBe(PolicyStatus.ACTIVE);
    });

    it('returns CANCELLED when status=CANCELLED regardless of endDate', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
      const result = resolver.resolve(
        makePolicy({ status: PrismaStatus.CANCELLED, endDate: future }),
      );
      expect(result).toBe(PolicyStatus.CANCELLED);
    });

    it('returns EXPIRED when status=ACTIVE and endDate is in the past', () => {
      const past = new Date('2020-01-01');
      const result = resolver.resolve(makePolicy({ endDate: past }));
      expect(result).toBe(PolicyStatus.EXPIRED);
    });

    // Edge cases
    it('returns CANCELLED (not EXPIRED) when CANCELLED and endDate is in the past', () => {
      const past = new Date('2020-01-01');
      const result = resolver.resolve(
        makePolicy({ status: PrismaStatus.CANCELLED, endDate: past }),
      );
      expect(result).toBe(PolicyStatus.CANCELLED);
    });

    it('returns EXPIRED when endDate is exactly now (boundary — past by ms)', () => {
      const justPast = new Date(Date.now() - 1);
      const result = resolver.resolve(makePolicy({ endDate: justPast }));
      expect(result).toBe(PolicyStatus.EXPIRED);
    });
  });

  describe('resolveMany', () => {
    it('returns array with computedStatus on each policy', () => {
      const future = new Date(Date.now() + 86400000);
      const policies = [makePolicy({ endDate: future }), makePolicy({ endDate: future })];
      const result = resolver.resolveMany(policies);
      expect(result).toHaveLength(2);
    });

    it('attaches correct computedStatus to each policy independently', () => {
      const future = new Date(Date.now() + 86400000);
      const past = new Date('2020-01-01');
      const policies = [
        makePolicy({ id: 'a', endDate: future }),
        makePolicy({ id: 'b', endDate: past }),
      ];
      const result = resolver.resolveMany(policies);
      expect(result[0].computedStatus).toBe(PolicyStatus.ACTIVE);
      expect(result[1].computedStatus).toBe(PolicyStatus.EXPIRED);
    });

    it('returns empty array for empty input', () => {
      const result = resolver.resolveMany([]);
      expect(result).toHaveLength(0);
    });
  });
});
