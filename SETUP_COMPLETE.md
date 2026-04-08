# NeureCore - Local Development Setup Complete ✓

**Date**: April 8, 2026  
**Status**: Ready for Local Development  
**Setup Time**: 5 minutes  
**Supported Platforms**: macOS, Linux, Windows (WSL2)

---

## 📊 System Status Summary

### Prerequisites Status ✅

| Component       | Status       | Version  | Details                     |
| --------------- | ------------ | -------- | --------------------------- |
| Docker          | ✅ Installed | 28.2.2   | Provides PostgreSQL & Redis |
| Docker Compose  | ✅ Installed | 1.29.2   | Orchestrates containers     |
| Node.js         | ✅ Installed | v24.14.0 | Exceeds v18+ requirement    |
| pnpm            | ✅ Installed | 10.33.0  | Package manager             |
| **System Disk** | ✅ Available | 2GB+     | Sufficient space            |

### Project Dependencies Status ✅

| Component             | Status       | Size  | Location                     |
| --------------------- | ------------ | ----- | ---------------------------- |
| Backend Dependencies  | ✅ Installed | 951MB | backend/node_modules         |
| Frontend Dependencies | ✅ Installed | 647MB | frontend-tenant/node_modules |
| Prisma Client         | ✅ Generated | -     | backend/node_modules/.prisma |
| Build Artifacts       | ⚠️ Not Built | -     | Will build on startup        |

### Configuration Status ✅

| File                | Status        | Location                   | JWT_SECRET | Database          | Redis             |
| ------------------- | ------------- | -------------------------- | ---------- | ----------------- | ----------------- |
| Backend .env        | ✅ Configured | backend/.env               | ✅ Set     | ✅ Local          | ✅ Local          |
| Frontend .env.local | ✅ Configured | frontend-tenant/.env.local | -          | ✅ Points to 3000 | ✅ Points to 3000 |

### Database Setup Status ✅

| Service    | Status         | Port | Ready          |
| ---------- | -------------- | ---- | -------------- |
| PostgreSQL | ⚠️ Not Running | 5432 | Ready to start |
| Redis      | ⚠️ Not Running | 6379 | Ready to start |
| pgvector   | ⚠️ Not Running | 5433 | Ready to start |

**Note**: Services will start automatically on demand with `docker-compose up -d`

---

## 🚀 How to Start Development

### Option A: Automated Setup (Recommended)

```bash
# 1. Run complete setup
cd /mnt/data/Web\ Dev/NeureCore
bash setup-local-dev.sh start

# 2a. Backend (Terminal 1)
cd backend && pnpm run start:dev

# 2b. Frontend (Terminal 2)
cd frontend-tenant && pnpm run dev
```

**Expected Output:**

- Backend: `NestApplication listening on localhost:3000`
- Frontend: `- ready started server on 0.0.0.0:3001`

### Option B: Manual Setup

```bash
# Step 1: Start databases
cd backend && docker-compose up -d

# Step 2: Run migrations
pnpm prisma migrate deploy

# Step 3: Start backend
pnpm run start:dev

# Step 4: Start frontend (new terminal)
cd frontend-tenant && pnpm run dev
```

---

## 📍 Access Points After Startup

| Service               | URL                            | Purpose          | Credentials          |
| --------------------- | ------------------------------ | ---------------- | -------------------- |
| **Frontend UI**       | http://localhost:3001          | Main application | Email-based login    |
| **Backend API**       | http://localhost:3000/api/v1   | REST API         | JWT tokens           |
| **API Documentation** | http://localhost:3000/api/docs | Swagger UI       | No auth needed       |
| **Database**          | localhost:5432                 | PostgreSQL       | `neurecore:password` |
| **Cache**             | localhost:6379                 | Redis            | No auth              |

---

## 📁 Key Files & Directories

### Setup & Documentation Files (Created)

```
/mnt/data/Web Dev/NeureCore/
├── QUICK_START.md                    # ← Start here (5 min guide)
├── LOCAL_DEVELOPMENT_SETUP.md        # ← Detailed setup guide
├── setup-local-dev.sh                # ← Automated setup script
├── preflight-check.sh                # ← Pre-flight verification
└── (this file)
```

### Backend Important Files

```
backend/
├── .env                              # Configuration (local)
├── .env.backup                       # Backup of original
├── docker-compose.yml                # PostgreSQL + Redis setup
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Database migrations
├── src/
│   ├── modules/                      # Feature modules
│   ├── config/                       # Configuration
│   └── common/                       # Shared utilities
├── package.json                      # Dependencies
└── verify-jwt-config.js              # JWT verification script
```

### Frontend Important Files

```
frontend-tenant/
├── .env.local                        # Configuration (local)
├── .env.example                      # Configuration template
├── src/
│   ├── app/                          # Next.js pages
│   ├── components/                   # React components
│   ├── hooks/                        # Custom hooks
│   └── lib/                          # Utilities
├── package.json                      # Dependencies
└── next.config.js                    # Next.js configuration
```

---

## 🔧 Common Setup Commands

### Start All Services (Recommended)

```bash
cd /mnt/data/Web\ Dev/NeureCore

# Full setup with databases
bash setup-local-dev.sh start

# Then start services in separate terminals
cd backend && pnpm run start:dev
cd frontend-tenant && pnpm run dev
```

### Database Management

```bash
cd backend

# Start Docker services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Fresh restart (removes data)
docker-compose down -v && docker-compose up -d

# Run migrations
pnpm prisma migrate deploy

# Seed database
pnpm prisma db seed

# Open database UI (optional)
pnpm prisma studio
```

### Backend Development

```bash
cd backend

# Start with hot reload
pnpm run start:dev

# Build
pnpm run build

# Tests
pnpm test
pnpm test:e2e

# Lint
pnpm lint

# Format
pnpm format

# Verify JWT configuration
node verify-jwt-config.js
```

### Frontend Development

```bash
cd frontend-tenant

# Start with hot reload
pnpm run dev

# Build
pnpm build

# Production start
pnpm start

# Type checking
pnpm type-check

# Lint
pnpm lint
```

---

## ⚙️ Environment Configuration Details

### Backend .env (What's Currently Set)

```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=debug

# Database (Points to Local Docker)
DATABASE_URL=postgresql://neurecore:password@localhost:5432/neurecore_dev
DATABASE_POOL_SIZE=5

# Cache (Points to Local Docker)
REDIS_URL=redis://localhost:6379

# Authentication (CRITICAL - Already Configured)
JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
JWT_ALGORITHM=HS256

# CORS (Allows Frontend on localhost:3001)
TENANT_FRONTEND_URL=http://localhost:3001
ADMIN_FRONTEND_URL=http://localhost:3002

# Features
ENABLE_AGENT_EXECUTION=true
ENABLE_WORKFLOW_AUTOMATION=true
```

### Frontend .env.local (What's Currently Set)

```env
# API Configuration
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_API_TIMEOUT=30000

# WebSocket/Real-time
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Frontend URLs
NEXT_PUBLIC_TENANT_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_URL=http://localhost:3002

# Development Features
NEXT_PUBLIC_ENABLE_DEBUG=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ANIMATIONS=true
```

---

## 🔍 Verification Checklist

Before starting services, verify:

- ✅ Docker installed and running: `docker --version`
- ✅ Node.js v18+: `node --version`
- ✅ pnpm installed: `pnpm --version`
- ✅ Backend dependencies: `ls backend/node_modules` (has 951MB content)
- ✅ Frontend dependencies: `ls frontend-tenant/node_modules` (has 647MB content)
- ✅ JWT_SECRET configured: `grep JWT_SECRET backend/.env`
- ✅ Disk space available: `df -h . | tail -1`

### Quick Verification Commands

```bash
# All at once
docker --version && node --version && pnpm --version && \
  grep JWT_SECRET backend/.env && \
  du -sh backend/node_modules frontend-tenant/node_modules && \
  echo "✅ All checks passed!"
```

---

## ⚠️ Troubleshooting Quick Reference

| Issue                     | Solution                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Port 3000/3001 in use     | `lsof -i :3000` then `kill -9 <PID>`                        |
| Docker won't start        | Ensure Docker Desktop is running                            |
| Database connection error | `docker-compose ps` to verify containers                    |
| JWT_SECRET missing        | `grep JWT_SECRET backend/.env` or readd it                  |
| Dependencies missing      | `cd backend && pnpm install`                                |
| Frontend can't reach API  | Check `NEXT_PUBLIC_API_URL` in `frontend-tenant/.env.local` |

**For detailed troubleshooting**, see `LOCAL_DEVELOPMENT_SETUP.md`

---

## 📊 Project Architecture at a Glance

```
┌────────────────────────────────────────────────────────────┐
│                    Browser (localhost:3001)                │
│            NeureCore Frontend - Next.js 15                  │
├────────────────────────────────────────────────────────────┤
│                          HTTP/WS                            │
├────────────────────────────────────────────────────────────┤
│                 Backend (localhost:3000)                    │
│              NeureCore API - NestJS                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Authentication (JWT)                               │  │
│  │ • REST API (/api/v1)                                │  │
│  │ • WebSocket (Socket.IO)                             │  │
│  │ • Modules (Agents, Tools, Memory, etc.)             │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│                SQL + Cache                                 │
├────────────────────────────────────────────────────────────┤
│  PostgreSQL (localhost:5432)  │  Redis (localhost:6379)    │
│  • Users                      │  • Sessions                │
│  • Agents                     │  • Cache                   │
│  • Workflows                  │  • Real-time data          │
│  • Data                       │                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🎓 Next Learning Steps

1. **Explore the Architecture**
   - Read: `docs/ARCHITECTURE_AND_API_SPEC.md`
   - Review: `backend/src/modules/` structure

2. **Test the API**
   - Visit: http://localhost:3000/api/docs
   - Try sample requests
   - Read response documentation

3. **Make a Change**
   - Edit a frontend component: `frontend-tenant/src/components/`
   - See hot reload in browser
   - Verify functionality

4. **Understand the Database**
   - Visit: http://localhost:3000/api/docs (if prisma studio available)
   - Or connect: `docker exec -it neurecore_postgres psql -U neurecore -d neurecore_dev`

5. **Read the Code**
   - Backend modules: `backend/src/modules/`
   - Frontend pages: `frontend-tenant/src/app/`

---

## 📈 Performance Expectations (Local Dev)

| Metric              | Expected | Notes                                |
| ------------------- | -------- | ------------------------------------ |
| Backend startup     | 5-10s    | First time longer due to compilation |
| Backend hot reload  | 1-3s     | Subsequent code changes              |
| Frontend startup    | 3-5s     | First time builds                    |
| Frontend hot reload | <1s      | Quick recompilation                  |
| Page load time      | <1s      | On local network                     |
| API response time   | <50ms    | In-process responses                 |
| Database query      | <10ms    | Local PostgreSQL                     |

---

## 🔐 Security Reminders (Local Dev Only)

⚠️ **These settings are for local development only:**

- JWT_SECRET is shared (not production-random)
- Database password is `password` (not secure)
- Debug logging is enabled
- CORS allows localhost:3001
- No HTTPS (uses HTTP)

**For production:**

- Generate secure JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Use strong database passwords
- Disable debug logging
- Restrict CORS to production domains
- Use HTTPS with valid certificates

---

## 📞 Support Resources

### Documentation Files

- [QUICK_START.md](./QUICK_START.md) - 5-minute quick start
- [LOCAL_DEVELOPMENT_SETUP.md](./LOCAL_DEVELOPMENT_SETUP.md) - Detailed setup guide
- [backend/README.md](./backend/README.md) - Backend documentation
- [docs/ARCHITECTURE_AND_API_SPEC.md](./docs/ARCHITECTURE_AND_API_SPEC.md) - System architecture

### Useful Scripts

- `setup-local-dev.sh` - Automated setup script
- `preflight-check.sh` - System verification
- `backend/verify-jwt-config.js` - JWT configuration checker

### Helpful Commands

```bash
# View all setup instructions
cat QUICK_START.md

# Run full setup
bash setup-local-dev.sh start

# Check system status
bash setup-local-dev.sh check

# View detailed documentation
less LOCAL_DEVELOPMENT_SETUP.md
```

---

## ✅ Completion Checklist

- ✅ All prerequisites verified and installed
- ✅ Backend and frontend dependencies installed
- ✅ Docker configuration ready (PostgreSQL + Redis)
- ✅ Environment variables configured
- ✅ JWT_SECRET properly set and validated
- ✅ Setup automation scripts created
- ✅ Documentation complete
- ✅ Ready for local development

---

## 🎉 Ready to Start!

Your NeureCore development environment is fully prepared.

**To begin development:**

```bash
cd /mnt/data/Web\ Dev/NeureCore

# Start services
bash setup-local-dev.sh start

# In Terminal 1: Backend
cd backend && pnpm run start:dev

# In Terminal 2: Frontend
cd frontend-tenant && pnpm run dev

# Access at http://localhost:3001
```

**Questions?** Check [LOCAL_DEVELOPMENT_SETUP.md](./LOCAL_DEVELOPMENT_SETUP.md) for detailed troubleshooting.

---

**Last Updated**: April 8, 2026 | **Status**: Ready ✓
