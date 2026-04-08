# NeureCore Local Development Setup Guide

> **Last Updated**: April 8, 2026  
> **Status**: Ready for Local Development  
> **Requirements**: Docker, Node.js 18+, pnpm, 2GB disk space

---

## Quick Start (5 minutes)

### One-Command Setup

```bash
cd /mnt/data/Web\ Dev/NeureCore
bash setup-local-dev.sh start
```

This will:

1. ✓ Check all prerequisites
2. ✓ Install dependencies
3. ✓ Start Docker services (PostgreSQL + Redis)
4. ✓ Run database migrations
5. ✓ Seed database with sample data

### Start Development Services (After Setup)

```bash
# Terminal 1: Backend API (port 3000)
cd backend
pnpm run start:dev

# Terminal 2: Frontend Tenant (port 3001)
cd frontend-tenant
pnpm run dev

# Terminal 3: (Optional) Monitor Docker
cd backend
docker-compose logs -f
```

**Access your application:**

- 🔗 **Frontend**: http://localhost:3001
- 🔗 **Backend API**: http://localhost:3000/api/v1
- 🔗 **API Documentation**: http://localhost:3000/api/docs

---

## Detailed Setup Steps

### 1. Prerequisites Check

Ensure you have installed:

```bash
# Check Node.js (18+ required)
node --version   # Should be v18.0.0 or higher

# Check pnpm
pnpm --version   # Should be 8.0.0 or higher

# Check Docker
docker --version
docker-compose --version

# If pnpm not installed:
npm install -g pnpm
```

### 2. Database Setup

The project uses **PostgreSQL** and **Redis** via Docker Compose.

#### Start Services

```bash
cd backend
docker-compose up -d

# Verify services are running
docker ps
# Should show: neurecore_postgres, neurecore_redis
```

#### Verify Connection

```bash
# Check PostgreSQL
docker exec neurecore_postgres psql -U neurecore -d neurecore_dev -c "SELECT 1"
# Should return: 1

# Check Redis
docker exec neurecore_redis redis-cli ping
# Should return: PONG
```

#### Database Configuration

The `.env` file in `backend/` contains:

```env
DATABASE_URL=postgresql://neurecore:password@localhost:5432/neurecore_dev
REDIS_URL=redis://localhost:6379
```

For remote/production databases, update these URLs in your `.env` file.

### 3. Install Dependencies

```bash
# Backend
cd backend
pnpm install

# Frontend
cd ../frontend-tenant
pnpm install

# Generate Prisma Client
cd ../backend
pnpm prisma generate
```

### 4. Database Migrations

```bash
cd backend

# Run migrations
pnpm prisma migrate deploy

# Or push schema (if no migrations exist)
pnpm prisma db push

# Seed database (if seed script exists)
pnpm prisma db seed
```

### 5. Backend Setup

```bash
cd backend

# Set environment variables
# .env file should already be configured for local dev

# Verify JWT_SECRET is configured (critical!)
grep "JWT_SECRET" .env
# Should show: JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!

# Build backend
pnpm run build

# Start development server
pnpm run start:dev

# Backend should be running on http://localhost:3000
```

### 6. Frontend Setup

```bash
cd frontend-tenant

# Verify .env.local is configured
cat .env.local

# Environment file should have:
# NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
# NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Start development server
pnpm run dev

# Frontend should be running on http://localhost:3001
```

---

## Using the Setup Script

### Available Commands

```bash
# Check all prerequisites
./setup-local-dev.sh check

# Install dependencies only
./setup-local-dev.sh install

# Start Docker services only
./setup-local-dev.sh db:start

# Run migrations only
./setup-local-dev.sh db:migrate

# Seed database
./setup-local-dev.sh db:seed

# Start backend development server
./setup-local-dev.sh backend:dev

# Start frontend development server
./setup-local-dev.sh frontend:dev

# Full setup (recommended for first time)
./setup-local-dev.sh start

# Stop all Docker services
./setup-local-dev.sh stop

# Clean everything (remove containers and volumes)
./setup-local-dev.sh clean

# Show help
./setup-local-dev.sh help
```

---

## Environment Configuration

### Backend (.env)

Key variables for local development:

```env
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database (Already configured for local Docker)
DATABASE_URL=postgresql://neurecore:password@localhost:5432/neurecore_dev

# Redis (Already configured for local Docker)
REDIS_URL=redis://localhost:6379

# JWT (Required - should already be set)
JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Frontend URLs (For CORS)
TENANT_FRONTEND_URL=http://localhost:3001
ADMIN_FRONTEND_URL=http://localhost:3002

# Features
ENABLE_AGENT_EXECUTION=true
ENABLE_WORKFLOW_AUTOMATION=true
```

### Frontend (.env.local)

Key variables for local development:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_API_TIMEOUT=30000

# WebSocket
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# App Configuration
NODE_ENV=development
NEXT_PUBLIC_ENABLE_DEBUG=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true

# Feature Flags
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
NEXT_PUBLIC_ENABLE_VOICE_COMMANDS=false
NEXT_PUBLIC_ENABLE_WORKFLOW_AUTOMATION=false
```

---

## Troubleshooting

### Issue: Port Already in Use

```bash
# Find process using port
lsof -i :3000    # Backend
lsof -i :3001    # Frontend
lsof -i :5432    # PostgreSQL
lsof -i :6379    # Redis

# Kill process
kill -9 <PID>

# Or use different ports
# Backend: pnpm run start:dev -- --port 3010
# Frontend: pnpm run dev -- -p 3011
```

### Issue: Docker Service Won't Start

```bash
# Check Docker status
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs redis

# Restart services
docker-compose restart

# Clean restart (removes volumes)
docker-compose down -v
docker-compose up -d
```

### Issue: Database Connection Error

```bash
# Verify PostgreSQL is running
docker exec neurecore_postgres psql -U neurecore -d neurecore_dev -c "\\l"

# Check DATABASE_URL in .env
grep DATABASE_URL backend/.env

# Must be: postgresql://neurecore:password@localhost:5432/neurecore_dev

# Run migrations again
cd backend
pnpm prisma migrate reset
```

### Issue: JWT_SECRET Missing

```bash
# Check if JWT_SECRET is set
grep JWT_SECRET backend/.env

# If missing, add it:
echo "JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!" >> backend/.env

# Verify JWT configuration
cd backend && node verify-jwt-config.js
```

### Issue: Frontend Can't Connect to Backend

```bash
# Verify backend is running
curl http://localhost:3000/api/v1/health

# Check CORS configuration
grep -E "TENANT_FRONTEND_URL|CORS" backend/.env

# Must include: TENANT_FRONTEND_URL=http://localhost:3001

# Check frontend API URL
grep NEXT_PUBLIC_API_URL frontend-tenant/.env.local

# Must be: NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

### Issue: "Cannot find module" errors

```bash
# Reinstall dependencies
cd backend && pnpm install && pnpm prisma generate
cd ../frontend-tenant && pnpm install

# Clear caches
cd backend && rm -rf node_modules/.pnpm && pnpm store prune
cd ../frontend-tenant && rm -rf node_modules/.pnpm && pnpm store prune
```

---

## Development Workflow

### Daily Development Session

```bash
# Step 1: Start databases (once per session)
bash setup-local-dev.sh db:start

# Step 2a: Backend development (Terminal 1)
cd backend
pnpm run start:dev

# Step 2b: Frontend development (Terminal 2)
cd frontend-tenant
pnpm run dev

# Step 3: Make changes and watch for hot reload
# Both backends support hot reload during development
```

### Making Database Changes

```bash
# Create a new migration
cd backend
pnpm prisma migrate dev --name describe_your_changes

# This will:
# 1. Create migration in: prisma/migrations/
# 2. Apply migration to database
# 3. Regenerate Prisma Client

# Or use db push for rapid prototyping:
pnpm prisma db push
```

### Testing

```bash
# Backend unit tests
cd backend
pnpm test

# Backend integration tests
pnpm test:integration

# Backend E2E tests
pnpm test:e2e

# Frontend tests
cd ../frontend-tenant
pnpm test
```

### Code Quality

```bash
# Backend linting
cd backend
pnpm lint

# Frontend linting
cd ../frontend-tenant
pnpm lint

# Type checking
cd ../frontend-tenant
pnpm type-check
```

---

## Architecture Overview

### Backend Structure

- **Framework**: NestJS + Node.js
- **Database**: PostgreSQL (Prisma ORM)
- **Cache**: Redis
- **Auth**: JWT tokens
- **API**: RESTful + WebSocket (Socket.IO)
- **Port**: 3000

### Frontend Structure

- **Framework**: Next.js 15 + React 19
- **Styling**: Tailwind CSS + Radix UI
- **API Client**: Axios
- **State**: React Hooks
- **Real-time**: Socket.IO client
- **Port**: 3001

### Communication Flow

```
Frontend (3001)
    ↓ HTTP/WebSocket
Backend API (3000)
    ↓ SQL
PostgreSQL (5432)

Redis (6379) - Cache/Sessions
```

---

## Performance & Resources

### Typical Resource Usage (Local Development)

| Component                 | Memory         | CPU         | Disk     |
| ------------------------- | -------------- | ----------- | -------- |
| Docker (Postgres + Redis) | 256MB          | Low         | 500MB    |
| Backend (Node)            | 200-400MB      | 1-2 cores   | 100MB    |
| Frontend (Next.js)        | 150-300MB      | 1 core      | 100MB    |
| **Total**                 | **~800MB-1GB** | **2 cores** | **~1GB** |

### Optimization Tips

```bash
# Enable faster builds
export TURBO_SKIP_PRUNE=true

# Reduce logging
export LOG_LEVEL=warn

# Increase Node memory if needed
export NODE_OPTIONS="--max-old-space-size=2048"
```

---

## Next Steps

### After Local Setup

1. **Verify Authentication**
   - Visit http://localhost:3001
   - Test login / signup workflow

2. **Test API Endpoints**
   - Backend API docs: http://localhost:3000/api/docs
   - Try sample requests: `curl http://localhost:3000/api/v1/health`

3. **Explore Modules**
   - Review backend architecture: `backend/src/modules/`
   - Review frontend components: `frontend-tenant/src/`

4. **Enable Features**
   - Agent execution: Set `ENABLE_AGENT_EXECUTION=true`
   - Workflow automation: Set `ENABLE_WORKFLOW_AUTOMATION=true`

5. **Read Documentation**
   - Backend setup: `backend/README.md`
   - Phase documentation: `docs/ARCHITECTURE_AND_API_SPEC.md`

---

## Getting Help

### Check Logs

```bash
# Backend logs
cd backend && pnpm run start:dev

# Frontend logs
cd frontend-tenant && pnpm run dev

# Docker logs
cd backend && docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Common Commands

```bash
# Backend version
cd backend && pnpm --version && node --version

# Frontend dependencies
cd frontend-tenant && pnpm list axios socket.io-client

# Prisma info
cd backend && pnpm prisma --version && pnpm prisma db execute --stdin < /dev/null

# Database stats
cd backend && docker exec neurecore_postgres psql -U neurecore -d neurecore_dev -c "
  SELECT schemaname, COUNT(*) as tables FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  GROUP BY schemaname;"
```

---

## Deployment Preparation

When ready to deploy to staging/production:

```bash
# 1. Build for production
cd backend
pnpm run build

cd ../frontend-tenant
pnpm run build

# 2. Run full test suite
cd ../backend
pnpm test:ci

# 3. Check environment configuration
cd ../backend && node verify-jwt-config.js

# 4. Deploy (see deployment docs)
# See: deployment/README.md
```

---

**Happy Coding! 🚀**

For issues or questions, check the logs and troubleshooting section above.
