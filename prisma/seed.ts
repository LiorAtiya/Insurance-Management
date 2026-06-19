import { PrismaClient, PolicyType, PolicyStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.policy.deleteMany();
  await prisma.customer.deleteMany();

  const alice = await prisma.customer.create({
    data: {
      nationalId: '123456789',
      firstName: 'Alice',
      lastName: 'Cohen',
      email: 'alice@example.com',
      phone: '050-1234567',
    },
  });

  const bob = await prisma.customer.create({
    data: {
      nationalId: '987654321',
      firstName: 'Bob',
      lastName: 'Levi',
      email: 'bob@example.com',
      phone: '052-9876543',
    },
  });

  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  await prisma.policy.createMany({
    data: [
      {
        policyNumber: `POL-${now.getFullYear()}-00001`,
        type: PolicyType.CAR,
        status: PolicyStatus.ACTIVE,
        premium: 300,
        startDate: now,
        endDate: nextYear,
        customerId: alice.id,
      },
      {
        policyNumber: `POL-${now.getFullYear()}-00002`,
        type: PolicyType.HEALTH,
        status: PolicyStatus.ACTIVE,
        premium: 500,
        startDate: now,
        endDate: nextYear,
        customerId: alice.id,
      },
      {
        policyNumber: `POL-${now.getFullYear()}-00003`,
        type: PolicyType.LIFE,
        status: PolicyStatus.CANCELLED,
        premium: 200,
        startDate: lastYear,
        endDate: now,
        cancelledAt: now,
        customerId: bob.id,
      },
    ],
  });

  console.log('Seed complete: 2 customers, 3 policies');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
