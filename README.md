# Insurance Management System

Backend REST API for an insurance agent to manage their book of business — customers and their policies.

Built with **NestJS + TypeScript + PostgreSQL + Prisma**.

---

## Architecture

### Folder Structure
```
src/
  main.ts                          # Bootstrap: ValidationPipe + PrismaExceptionFilter
  app.module.ts
  common/
    enums/
      policy-type.enum.ts          # CAR | HEALTH | LIFE
      policy-status.enum.ts        # ACTIVE | CANCELLED | EXPIRED
    filters/
      prisma-exception.filter.ts   # Maps P2002→409, P2025→404
  prisma/
    prisma.service.ts              # Global DB client (OnModuleInit/Destroy)
    prisma.module.ts               # @Global — no repeated imports
  customers/
    customers.controller.ts
    customers.service.ts
    customers.module.ts
    dto/                           # create / update / query
    entities/customer.entity.ts
  policies/
    policies.controller.ts
    policies.service.ts
    policy-status.resolver.ts      # Pure EXPIRED computation at read-time
    policies.module.ts
    dto/                           # issue / update / query
    entities/policy.entity.ts
prisma/
  schema.prisma
  seed.ts
```

### Data Model
```
Customer
  id          UUID (PK)
  nationalId  String  UNIQUE          ← business identity key
  firstName   String
  lastName    String
  email       String? (NOT unique)    ← family members may share
  phone       String?
  isActive    Boolean (default true)  ← soft-delete flag
  deletedAt   DateTime?
  policies    Policy[]

Policy
  id           UUID (PK)
  policyNumber String  UNIQUE         ← POL-{year}-{seq}, system-generated
  type         PolicyType (CAR|HEALTH|LIFE)
  status       PolicyStatus (ACTIVE|CANCELLED)   ← EXPIRED is computed, never stored
  premium      Decimal(10,2)  > 0
  startDate    DateTime
  endDate      DateTime       > startDate
  cancelledAt  DateTime?
  customerId   UUID (FK → Customer)
```

### Layers
```
HTTP Request
    ↓
Controller   (routing only — no business logic)
    ↓
Service      (business logic, integrity rules, error throwing)
    ↓
PrismaService (DAL — single DB client, globally provided)
    ↓
PostgreSQL
```

`PolicyStatusResolver` is a dedicated injectable that computes the effective status from `endDate` and DB status. Used by `PoliciesService` on every read — no cron, no write-back.

---

## API Endpoints

### Customers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/customers` | Create a new customer |
| `GET` | `/customers` | List customers (optional: `?search=&isActive=`) |
| `GET` | `/customers/:id` | Get one customer |
| `PATCH` | `/customers/:id` | Update customer details |
| `DELETE` | `/customers/:id` | Soft-delete customer |

### Policies

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/customers/:customerId/policies` | Issue a new policy to a customer |
| `GET` | `/policies` | List policies (optional: `?type=&status=&customerId=`) |
| `GET` | `/policies/:id` | Get one policy |
| `PATCH` | `/policies/:id` | Update policy details |
| `DELETE` | `/policies/:id` | Cancel (soft) a policy |

### Request Bodies

**POST /customers**
```json
{
  "nationalId": "123456789",
  "firstName": "Alice",
  "lastName": "Cohen",
  "email": "alice@example.com",
  "phone": "050-1234567"
}
```

**POST /customers/:id/policies**
```json
{
  "type": "CAR",
  "premium": 300.00,
  "startDate": "2026-01-01",
  "endDate": "2027-01-01"
}
```

**PATCH /policies/:id**
```json
{
  "premium": 350.00,
  "endDate": "2027-06-01"
}
```

---

## Error Handling

| Scenario | HTTP |
|----------|------|
| Issue policy to non-existent / deleted customer | `404` |
| Get / update / cancel non-existent policy or customer | `404` |
| Create customer with duplicate `nationalId` | `409` |
| Cancel already-cancelled or expired policy | `409` |
| Update a non-ACTIVE policy | `409` |
| Delete customer with active policies | `409` |
| `endDate <= startDate` | `400` |
| `premium <= 0` | `400` |
| Invalid enum value (type/status) | `400` |
| Unknown fields in request body | `400` (`forbidNonWhitelisted`) |

Prisma constraint errors (P2002 unique, P2025 not found) are caught globally by `PrismaExceptionFilter` as a safety net.

---

## Setup & Running

### Prerequisites
- Node.js 18+
- Docker + Docker Compose

### 1. Clone & install
```bash
git clone <repo-url>
cd insurance-management
npm install
```

### 2. Environment
```bash
cp .env.example .env
# Default values work out of the box with docker-compose
```

`.env` content:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/insurance_db"
PORT=3000
```

### 3. Start the database
```bash
docker-compose up -d
```

### 4. Run migrations & generate Prisma client
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. (Optional) Seed sample data
```bash
npm run prisma:seed
# Creates: 2 customers, 3 policies (ACTIVE car, ACTIVE health, CANCELLED life)
```

### 6. Start the API
```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build && npm run start:prod
```

API available at `http://localhost:3000`

### 7. Run tests
```bash
npm test
```

---

## Assumptions

1. **Single agent system** — no auth, no multi-tenancy. All data belongs to one agent.
2. **`nationalId` is the unique business key** for customers (9-digit Israeli ID). Email is optional and not unique — family members may share one.
3. **EXPIRED is never stored** — it is derived at read-time from `endDate < now`. The DB only stores `ACTIVE` or `CANCELLED`. This means no cron jobs and no stale state.
4. **A customer may hold multiple policies of the same type** — e.g. two CAR policies for two vehicles. Uniqueness is on `policyNumber` only.
5. **`policyNumber` is system-generated** — format `POL-{year}-{seq}` (e.g. `POL-2026-00042`). The client never supplies it.
6. **Cancellation is permanent** — `CANCELLED → ACTIVE` transition is not allowed. A new policy must be issued.
7. **Soft-delete only** — neither customers nor policies are hard-deleted. History is always preserved.
8. **Blocking delete** — a customer with ≥1 ACTIVE policy cannot be soft-deleted. All active policies must be cancelled first.
9. **premium is monetary** — stored as `Decimal(10,2)`, must be > 0.

---

## Non-Obvious Decisions

**`EXPIRED` computed at read-time, not stored** — why: a stored status requires either a background job to flip it (operational complexity) or a write-back on every read (side-effect in a GET). Computing it on the fly is always correct, zero infrastructure, and aligns with the principle that a query should not mutate state.

**`POST /customers/:id/policies` (nested) over `POST /policies`** — why: the task says "issue a policy *to an existing customer*". The nested route makes the ownership constraint explicit in the URL, not buried in the request body.

**`policyNumber` uniqueness via DB constraint, not app-level check** — why: an app-level `findFirst → insert` sequence has a race condition under concurrent requests. The `UNIQUE` constraint on the column is the authoritative guard; the app-level `MAX(seq)+1` is a convenience, not the safety net.

**No repository layer over Prisma** — why: Prisma already *is* the repository (typed queries, migrations, relations). Wrapping it in another abstraction layer within a 5-hour scope adds boilerplate without benefit. The `PrismaService` is injected directly into services via NestJS DI — fully testable with mocks.

**`status` filter applied in-memory after DB fetch** — why: EXPIRED is computed, not stored. Filtering by `status=EXPIRED` in SQL is impossible. All filters that *are* stored (`type`, `customerId`) are applied at the DB level; `status` is the only post-fetch filter.
