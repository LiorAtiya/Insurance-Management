import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PolicyStatus } from '@prisma/client';

const mockCustomer = {
  id: 'uuid-1',
  nationalId: '123456789',
  firstName: 'Alice',
  lastName: 'Cohen',
  email: 'alice@example.com',
  phone: '050-0000000',
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  customer: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  policy: {
    count: jest.fn(),
  },
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  // --- create ---
  describe('create', () => {
    it('creates and returns a customer', async () => {
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      const result = await service.create({
        nationalId: '123456789',
        firstName: 'Alice',
        lastName: 'Cohen',
      });
      expect(result.nationalId).toBe('123456789');
    });

    it('calls prisma.customer.create with the dto data', async () => {
      mockPrisma.customer.create.mockResolvedValue(mockCustomer);
      const dto = { nationalId: '123456789', firstName: 'Alice', lastName: 'Cohen' };
      await service.create(dto);
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  // --- findOne ---
  describe('findOne', () => {
    it('returns the customer when found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      const result = await service.findOne('uuid-1');
      expect(result.id).toBe('uuid-1');
    });

    it('throws NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // --- update ---
  describe('update', () => {
    it('returns updated customer', async () => {
      const updated = { ...mockCustomer, phone: '054-9999999' };
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.customer.update.mockResolvedValue(updated);
      const result = await service.update('uuid-1', { phone: '054-9999999' });
      expect(result.phone).toBe('054-9999999');
    });

    it('throws NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { phone: '050-0000000' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- softDelete ---
  describe('softDelete', () => {
    it('soft-deletes customer when no active policies', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.policy.count.mockResolvedValue(0);
      mockPrisma.customer.update.mockResolvedValue({ ...mockCustomer, isActive: false });
      await expect(service.softDelete('uuid-1')).resolves.toBeUndefined();
    });

    it('throws ConflictException when customer has active policies', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.policy.count.mockResolvedValue(2);
      await expect(service.softDelete('uuid-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('missing')).rejects.toThrow(NotFoundException);
    });

    it('counts only ACTIVE policies with endDate in the future', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrisma.policy.count.mockResolvedValue(0);
      mockPrisma.customer.update.mockResolvedValue({ ...mockCustomer, isActive: false });
      await service.softDelete('uuid-1');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PolicyStatus.ACTIVE,
            endDate: expect.objectContaining({ gt: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  // --- restore ---
  describe('restore', () => {
    it('restores a deleted customer', async () => {
      const deleted = { ...mockCustomer, isActive: false, deletedAt: new Date() };
      const restored = { ...mockCustomer, isActive: true, deletedAt: null };
      mockPrisma.customer.findUnique.mockResolvedValue(deleted);
      mockPrisma.customer.update.mockResolvedValue(restored);
      const result = await service.restore('uuid-1');
      expect(result.isActive).toBe(true);
    });

    it('throws ConflictException when customer is already active', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);
      await expect(service.restore('uuid-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.restore('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
