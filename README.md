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

### Layers & Separation of Concerns

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

Each layer has a single responsibility and strict boundaries:

| Layer | Responsibility | What it does NOT do |
|---|---|---|
| **Controller** | Extract params/body, call service, return response | No business logic, no DB access |
| **Service** | Business rules, state transitions, integrity checks | No HTTP knowledge, no raw SQL |
| **PolicyStatusResolver** | Compute effective policy status from `endDate` | No DB queries, no side effects |
| **PrismaService** | DB connection lifecycle | No business rules |
| **PrismaExceptionFilter** | Map DB errors (P2002→409, P2025→404) to HTTP | No domain knowledge |

`PolicyStatusResolver` is extracted into its own injectable because the same status-computation rule is applied in every read path (`findAll`, `findOne`, `update`, `cancel`). Keeping it in one place ensures a single point of change if the business rule ever evolves — a direct application of SRP.

---

## API Endpoints

### Customers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/customers` | Create a new customer |
| `GET` | `/customers` | List customers (optional: `?search=&isActive=`) |
| `GET` | `/customers/:id` | Get one customer |
| `PATCH` | `/customers/:id` | Update customer details |
| `PATCH` | `/customers/:id/restore` | Restore a soft-deleted customer |
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

Two modes available: **fully containerized** (Docker) or **local** (Node on host + Docker for DB only).

---

### Option A — Full Docker (recommended for quick start)

**Prerequisites:** Docker + Docker Compose only. No Node.js required.

```bash
git clone <repo-url>
cd insurance-management

# Build and start both API + Postgres
docker-compose up --build
```

API available at `http://localhost:3000`

The API container automatically runs `prisma migrate deploy` on startup.

To seed sample data:
```bash
docker-compose exec api npm run prisma:seed
```

To stop:
```bash
docker-compose down
```

---

### Option B — Local (Node on host + Docker for DB)

**Prerequisites:** Node.js 18+, Docker + Docker Compose.

#### 1. Clone & install
```bash
git clone <repo-url>
cd insurance-management
npm install
```

#### 2. Environment
Create a `.env` file in the project root:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/insurance_db"
PORT=3000
```

#### 3. Start the database
```bash
docker-compose up -d postgres
```

#### 4. Run migrations & generate Prisma client
```bash
npx prisma migrate dev --name init
npx prisma generate
```

#### 5. (Optional) Seed sample data
```bash
npm run prisma:seed
# Creates: 2 customers, 3 policies (ACTIVE car, ACTIVE health, CANCELLED life)
```

#### 6. Start the API
```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build && npm run start:prod
```

API available at `http://localhost:3000`

---

### Run tests

```bash
# Unit tests (21 tests — PolicyStatusResolver + CustomersService)
npm test

# E2E tests (53 tests — full API flow, validation, security, performance)
# Requires: Docker running + API not already listening on port 3000
npm run test:e2e
```

Test coverage includes:
- Happy path — full customer + policy lifecycle
- Validation — nationalId format, premium > 0, date ordering, enum values
- Error cases — 400 / 404 / 409 across all endpoints
- Security — SQL injection, XSS payload handling, unknown field rejection, malformed UUIDs
- Performance — all key endpoints respond within 500ms

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

**No authentication or rate limiting** — intentionally omitted. This is a single-agent system with no public exposure — there is no concept of "who is logged in" and no multi-tenant attack surface. Adding rate limiting without auth would only limit by IP, which is weak and misleading. In a production multi-tenant system, the correct order would be: JWT auth per agent → per-user rate limiting (e.g. `@nestjs/throttler`) → role-based access control. These are the natural next layers but are out of scope for this challenge.

---

## Future Improvements

Natural next steps to evolve this into a full production system:

**Security & Access**
- **JWT Authentication** — each agent logs in and receives a token; all endpoints require `Authorization: Bearer <token>`
- **Role-based access control (RBAC)** — distinguish between agent, manager, and read-only roles
- **Rate limiting** — `@nestjs/throttler` per authenticated user to prevent abuse

**API Enhancements**
- **Pagination** — `GET /policies` and `GET /customers` with `?page=&limit=` for large datasets
- **Swagger / OpenAPI docs** — `@nestjs/swagger` auto-generates interactive API documentation from DTOs and decorators
- **Webhook / event system** — emit events on policy cancellation or expiry (e.g. notify the agent)

**Data & Business Logic**
- **Policy renewal** — `POST /policies/:id/renew` creates a new policy from an expired one with an updated date range
- **Claim management** — a third entity `Claim` linked to a Policy (filing, tracking, resolution)
- **Premium history** — audit log of premium changes per policy
- **Automated EXPIRED status** — a scheduled job (`@nestjs/schedule`) to persist EXPIRED status in DB nightly, enabling DB-level filtering without in-memory resolution

**Infrastructure**
- **Redis cache** — cache frequently read customer+policy lists to reduce DB load
- **Observability** — structured logging (Winston/Pino) + health check endpoint (`/health`) for monitoring
- **CI/CD pipeline** — GitHub Actions: run tests on every PR, build Docker image on merge to main
