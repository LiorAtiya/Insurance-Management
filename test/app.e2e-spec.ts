import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';

describe('Insurance Management API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let customerId: string;
  let policyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean slate
    await prisma.policy.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterAll(async () => {
    await prisma.policy.deleteMany();
    await prisma.customer.deleteMany();
    await app.close();
  });

  // ─── Customers ────────────────────────────────────────────────────────────

  describe('POST /customers', () => {
    it('creates a customer and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({ nationalId: '123456789', firstName: 'Alice', lastName: 'Cohen', email: 'alice@test.com' });
      expect(res.status).toBe(201);
      customerId = res.body.id;
    });

    it('returns id in response body', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({ nationalId: '111111111', firstName: 'Bob', lastName: 'Levi' });
      expect(res.body.id).toBeDefined();
    });

    it('returns 409 on duplicate nationalId', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({ nationalId: '123456789', firstName: 'Dup', lastName: 'User' });
      expect(res.status).toBe(409);
    });

    it('returns 400 when nationalId is not 9 digits', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({ nationalId: '123', firstName: 'Bad', lastName: 'Input' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when unknown field is sent', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({ nationalId: '222222222', firstName: 'X', lastName: 'Y', unknownField: 'z' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when firstName is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers')
        .send({ nationalId: '333333333', lastName: 'Y' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /customers', () => {
    it('returns 200 with array', async () => {
      const res = await request(app.getHttpServer()).get('/customers');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by isActive=true', async () => {
      const res = await request(app.getHttpServer()).get('/customers?isActive=true');
      expect(res.status).toBe(200);
      expect(res.body.every((c: any) => c.isActive === true)).toBe(true);
    });

    it('filters by search term (case-insensitive)', async () => {
      const res = await request(app.getHttpServer()).get('/customers?search=alice');
      expect(res.status).toBe(200);
      expect(res.body.some((c: any) => c.firstName === 'Alice')).toBe(true);
    });
  });

  describe('GET /customers/:id', () => {
    it('returns the customer by id', async () => {
      const res = await request(app.getHttpServer()).get(`/customers/${customerId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customerId);
    });

    it('returns 404 for non-existent id', async () => {
      const res = await request(app.getHttpServer()).get('/customers/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /customers/:id', () => {
    it('updates customer phone and returns 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/customers/${customerId}`)
        .send({ phone: '054-9999999' });
      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('054-9999999');
    });

    it('returns 404 for non-existent customer', async () => {
      const res = await request(app.getHttpServer())
        .patch('/customers/00000000-0000-0000-0000-000000000000')
        .send({ phone: '050-0000000' });
      expect(res.status).toBe(404);
    });
  });

  // ─── Policies ─────────────────────────────────────────────────────────────

  describe('POST /customers/:id/policies', () => {
    it('issues a policy and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'CAR', premium: 300, startDate: '2026-01-01', endDate: '2027-01-01' });
      expect(res.status).toBe(201);
      policyId = res.body.id;
    });

    it('returns a system-generated policyNumber', async () => {
      const res = await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'HEALTH', premium: 500, startDate: '2026-01-01', endDate: '2027-06-01' });
      expect(res.body.policyNumber).toMatch(/^POL-\d{4}-\d{5}$/);
    });

    it('returns computedStatus=ACTIVE for a new policy', async () => {
      const res = await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'LIFE', premium: 200, startDate: '2026-01-01', endDate: '2027-01-01' });
      expect(res.body.computedStatus).toBe('ACTIVE');
    });

    it('returns 404 for non-existent customer', async () => {
      const res = await request(app.getHttpServer())
        .post('/customers/00000000-0000-0000-0000-000000000000/policies')
        .send({ type: 'CAR', premium: 300, startDate: '2026-01-01', endDate: '2027-01-01' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when endDate is before startDate', async () => {
      const res = await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'CAR', premium: 300, startDate: '2027-01-01', endDate: '2026-01-01' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when premium is negative', async () => {
      const res = await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'CAR', premium: -100, startDate: '2026-01-01', endDate: '2027-01-01' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid policy type', async () => {
      const res = await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'BOAT', premium: 300, startDate: '2026-01-01', endDate: '2027-01-01' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /policies', () => {
    it('returns 200 with array', async () => {
      const res = await request(app.getHttpServer()).get('/policies');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by type=CAR', async () => {
      const res = await request(app.getHttpServer()).get('/policies?type=CAR');
      expect(res.status).toBe(200);
      expect(res.body.every((p: any) => p.type === 'CAR')).toBe(true);
    });

    it('filters by status=ACTIVE', async () => {
      const res = await request(app.getHttpServer()).get('/policies?status=ACTIVE');
      expect(res.status).toBe(200);
      expect(res.body.every((p: any) => p.computedStatus === 'ACTIVE')).toBe(true);
    });

    it('filters by customerId', async () => {
      const res = await request(app.getHttpServer()).get(`/policies?customerId=${customerId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((p: any) => p.customerId === customerId)).toBe(true);
    });

    it('returns 400 for invalid status filter', async () => {
      const res = await request(app.getHttpServer()).get('/policies?status=UNKNOWN');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /policies/:id', () => {
    it('returns policy by id', async () => {
      const res = await request(app.getHttpServer()).get(`/policies/${policyId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(policyId);
    });

    it('returns 404 for non-existent policy', async () => {
      const res = await request(app.getHttpServer()).get('/policies/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /policies/:id', () => {
    it('updates premium and returns 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/policies/${policyId}`)
        .send({ premium: 350 });
      expect(res.status).toBe(200);
    });

    it('returns updated premium value', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/policies/${policyId}`)
        .send({ premium: 400 });
      expect(Number(res.body.premium)).toBe(400);
    });

    it('returns 400 when endDate <= startDate after update', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/policies/${policyId}`)
        .send({ endDate: '2025-01-01' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent policy', async () => {
      const res = await request(app.getHttpServer())
        .patch('/policies/00000000-0000-0000-0000-000000000000')
        .send({ premium: 300 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /policies/:id (cancel)', () => {
    it('cancels a policy and returns 204', async () => {
      const res = await request(app.getHttpServer()).delete(`/policies/${policyId}`);
      expect(res.status).toBe(204);
    });

    it('returns 409 when cancelling an already-cancelled policy', async () => {
      const res = await request(app.getHttpServer()).delete(`/policies/${policyId}`);
      expect(res.status).toBe(409);
    });

    it('returns 409 when updating a cancelled policy', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/policies/${policyId}`)
        .send({ premium: 999 });
      expect(res.status).toBe(409);
    });
  });

  // ─── Customer lifecycle ────────────────────────────────────────────────────

  describe('DELETE /customers/:id (soft-delete)', () => {
    it('returns 409 when customer still has active policies', async () => {
      // Issue a fresh active policy first
      await request(app.getHttpServer())
        .post(`/customers/${customerId}/policies`)
        .send({ type: 'CAR', premium: 300, startDate: '2026-01-01', endDate: '2027-01-01' });

      const res = await request(app.getHttpServer()).delete(`/customers/${customerId}`);
      expect(res.status).toBe(409);
    });

    it('soft-deletes customer after all active policies are cancelled', async () => {
      // Cancel all active policies
      const policiesRes = await request(app.getHttpServer())
        .get(`/policies?customerId=${customerId}&status=ACTIVE`);
      for (const p of policiesRes.body) {
        await request(app.getHttpServer()).delete(`/policies/${p.id}`);
      }

      const res = await request(app.getHttpServer()).delete(`/customers/${customerId}`);
      expect(res.status).toBe(204);
    });

    it('deleted customer has isActive=false', async () => {
      const res = await request(app.getHttpServer()).get(`/customers/${customerId}`);
      expect(res.body.isActive).toBe(false);
    });

    it('deleted customer does not appear in isActive=true filter', async () => {
      const res = await request(app.getHttpServer()).get('/customers?isActive=true');
      const found = res.body.find((c: any) => c.id === customerId);
      expect(found).toBeUndefined();
    });
  });

  describe('PATCH /customers/:id/restore', () => {
    it('restores a deleted customer and returns 200', async () => {
      const res = await request(app.getHttpServer()).patch(`/customers/${customerId}/restore`);
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
    });

    it('returns 409 when restoring an already-active customer', async () => {
      const res = await request(app.getHttpServer()).patch(`/customers/${customerId}/restore`);
      expect(res.status).toBe(409);
    });
  });
});
