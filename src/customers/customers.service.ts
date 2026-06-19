import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { Customer, Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.prisma.customer.findUnique({
      where: { nationalId: dto.nationalId },
    });
    if (existing) {
      throw new ConflictException(
        `Customer with nationalId ${dto.nationalId} already exists`,
      );
    }

    return this.prisma.customer.create({ data: dto });
  }

  async findAll(query: QueryCustomersDto): Promise<Customer[]> {
    const where: Prisma.CustomerWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { nationalId: { contains: query.search } },
      ];
    }

    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);

    const activeCount = await this.prisma.policy.count({
      where: { customerId: id, status: 'ACTIVE' },
    });

    if (activeCount > 0) {
      throw new ConflictException(
        `Cannot delete customer with ${activeCount} active policy(ies). Cancel them first.`,
      );
    }

    await this.prisma.customer.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  }
}
