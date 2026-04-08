# NeureCore - Quick Start Guide (Local Development)

**Last Updated**: April 8, 2026 | **Status**: ✓ Ready for Local Development

---

## System Status ✓

All prerequisites installed and verified:

- ✓ Docker 28.2.2
- ✓ Docker Compose 1.29.2
- ✓ Node.js v24.14.0 (18+ required)
- ✓ pnpm 10.33.0
- ✓ Backend dependencies installed (951MB)
- ✓ Frontend-tenant dependencies installed (647MB)
- ✓ Disk space available (2GB+)

---

## 🚀 Quick Start (5 minutes)

### Option 1: Automated Setup (Recommended)

```bash
cd /mnt/data/Web\ Dev/NeureCore

# Full automated setup
bash setup-local-dev.sh start

# Then in separate terminals:
# Terminal 1
cd backend && pnpm run start:dev

# Terminal 2
cd frontend-tenant && pnpm run dev
```

### Option 2: Manual Setup (Step by Step)

#### Step 1: Start Databases

```bash
cd backend
docker-compose up -d

# Verify
docker ps  # Should see neurecore_postgres and neurecore_redis
docker exec neurecore_postgres psql -U neurecore -d neurecore_dev -c "SELECT 1"  # Should return 1
```

#### Step 2: Database Setup

```bash
cd backend
pnpm prisma migrate deploy  # Run migrations
# pnpm prisma db seed       # Optional: seed sample data
```

#### Step 3: Start Backend

```bash
cd backend
pnpm run start:dev
# Backend running on http://localhost:3000
```

#### Step 4: Start Frontend (in new terminal)

```bash
cd frontend-tenant
pnpm run dev
# Frontend running on http://localhost:3001
```

---

## 📍 Access Points

Once running:

| Service             | URL                            | Purpose               |
| ------------------- | ------------------------------ | --------------------- |
| **Frontend Tenant** | http://localhost:3001          | User application      |
| **Backend API**     | http://localhost:3000/api/v1   | API endpoints         |
| **API Docs**        | http://localhost:3000/api/docs | Swagger documentation |
| **PostgreSQL**      | localhost:5432                 | Database              |
| **Redis**           | localhost:6379                 | Cache                 |

**Default Credentials** (if seeded):

- Email: `admin@example.com`
- Password: `password123` (change in production!)

---

## 📋 Environment Configuration

### Backend (.env) - Key Variables

```bash
# Database (using local Docker)
DATABASE_URL=postgresql://neurecore:password@localhost:5432/neurecore_dev

# Redis (using local Docker)
REDIS_URL=redis://localhost:6379

# JWT (REQUIRED - already configured)
JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!

# Frontend URLs (for CORS)
TENANT_FRONTEND_URL=http://localhost:3001
ADMIN_FRONTEND_URL=http://localhost:3002
```

**Location**: `backend/.env`

### Frontend (.env.local) - Key Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Development
NODE_ENV=development
NEXT_PUBLIC_ENABLE_DEBUG=true
```

**Location**: `frontend-tenant/.env.local`

---

## 🔧 Common Commands

### Backend Commands

```bash
cd backend

# Development with hot reload
pnpm run start:dev

# Build for production
pnpm run build

# Run tests
pnpm test
pnpm test:e2e

# Linting
pnpm lint

# Database migrations
pnpm prisma migrate dev --name my_migration
pnpm prisma migrate deploy
pnpm prisma db seed

# Verify JWT configuration
node verify-jwt-config.js
```

### Frontend Commands

```bash
cd frontend-tenant

# Development with hot reload
pnpm run dev

# Build for production
pnpm build

# Start production build
pnpm start

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### Docker Commands

```bash
cd backend

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f
docker-compose logs -f postgres
docker-compose logs -f redis

# Clean restart (removes volumes)
docker-compose down -v
docker-compose up -d
```

---

## ⚠️ Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :3000     # Backend
lsof -i :3001     # Frontend
lsof -i :5432     # PostgreSQL
lsof -i :6379     # Redis

# Kill the process
kill -9 <PID>

# Or use different ports
cd backend && pnpm run start:dev -- --port 3010
cd frontend-tenant && pnpm run dev -- -p 3011
```

### Docker Service Won't Start

```bash
# Check Docker status
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs redis

# Clean restart
docker-compose down -v
docker-compose up -d
```

### Database Connection Error

```bash
# Verify PostgreSQL is running
docker exec neurecore_postgres psql -U neurecore -d neurecore_dev -c "\\l"

# Check DATABASE_URL in .env
grep DATABASE_URL backend/.env

# Must be: postgresql://neurecore:password@localhost:5432/neurecore_dev

# Reset migrations
cd backend && pnpm prisma migrate reset
```

### Frontend Can't Connect to Backend

```bash
# 1. Verify backend is running
curl http://localhost:3000/api/v1/health

# 2. Check CORS configuration
grep TENANT_FRONTEND_URL backend/.env
# Should have: TENANT_FRONTEND_URL=http://localhost:3001

# 3. Check frontend API URL
grep NEXT_PUBLIC_API_URL frontend-tenant/.env.local
# Should have: NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# 4. Check browser console for CORS errors
```

### JWT_SECRET Missing Error

```bash
# Verify JWT_SECRET is set
grep JWT_SECRET backend/.env

# Should see: JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!

# If missing, add it:
echo "JWT_SECRET=NeureCore2026ProdSecretKey-Minimum32CharsRequired!" >> backend/.env

# Verify setup
cd backend && node verify-jwt-config.js
```

---

## 🔍 Monitoring & Debugging

### View Backend Logs

```bash
cd backend
pnpm run start:dev

# Output shows request logging, database queries, errors
```

### View Frontend Logs

```bash
cd frontend-tenant
pnpm run dev

# Check browser console (F12) for client-side errors
```

### View Docker Logs

```bash
cd backend

# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres   # Database logs
docker-compose logs -f redis      # Cache logs

# Follow logs (tail -f equivalent)
docker-compose logs -f --tail=50  # Last 50 lines
```

### Database Query Inspection

```bash
# Connect to PostgreSQL directly
docker exec -it neurecore_postgres psql -U neurecore -d neurecore_dev

# Useful commands:
\l              # List databases
\dt             # List tables
\d table_name   # Describe table
SELECT COUNT(*) FROM table_name;  # Count rows
```

### API Testing

```bash
# Using curl
curl http://localhost:3000/api/v1/health

# Using Swagger UI
# Visit: http://localhost:3000/api/docs

# Test authentication
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'
```

---

## 📚 Project Structure

```
/mnt/data/Web Dev/NeureCore/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   ├── config/            # Configuration
│   │   └── common/            # Shared utilities
│   ├── prisma/                # Database schema
│   ├── .env                   # Environment (local)
│   ├── docker-compose.yml     # PostgreSQL + Redis
│   └── package.json
│
├── frontend-tenant/           # Next.js application
│   ├── src/
│   │   ├── app/              # Next.js app directory
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks
│   │   └── lib/              # Utilities
│   ├── .env.local            # Environment (local)
│   └── package.json
│
├── setup-local-dev.sh         # Setup automation script
├── preflight-check.sh         # Pre-flight verification
└── LOCAL_DEVELOPMENT_SETUP.md # Detailed guide
```

---

## 🚦 Development Workflow

### Daily Development Session

```bash
# Terminal 1: Start databases (once per session)
cd backend && docker-compose up -d

# Terminal 2: Backend development
cd backend && pnpm run start:dev

# Terminal 3: Frontend development
cd frontend-tenant && pnpm run dev

# Make changes to code - both support hot reload
# Changes are automatically compiled and reloaded
```

### Making Database Changes

```bash
# Create migration
cd backend
pnpm prisma migrate dev --name describe_your_changes

# Or quick push for prototyping
pnpm prisma db push
```

### Running Tests

```bash
# Backend tests
cd backend
pnpm test              # Run all tests
pnpm test:watch       # Watch mode
pnpm test:e2e         # End-to-end tests

# Frontend tests (component testing)
cd frontend-tenant
pnpm test
```

---

## 🔐 Security Notes for Local Development

### ⚠️ Important for Local Use Only

1. **JWT_SECRET**: Currently set to a shared value for easy local testing
   - Change for production: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Store securely in environment variables

2. **Database Password**: Set to `password` locally
   - Change for production: Use strong password from secrets manager

3. **CORS Configuration**: Allows localhost:3001
   - Restrict to production domains in production

4. **Debug Mode**: Enabled (`LOG_LEVEL=debug`)
   - Disable in production (set to `warn` or `error`)

5. **Environment**: All APIs use HTTP (not HTTPS) locally
   - Use HTTPS in production

---

## 📞 Getting Help

### Quick Debug Checklist

1. ✓ Are Docker services running? `docker ps`
2. ✓ Is PostgreSQL responding? `docker exec neurecore_postgres pg_isready -U neurecore -d neurecore_dev`
3. ✓ Is Redis responding? `docker exec neurecore_redis redis-cli ping`
4. ✓ Is JWT_SECRET set? `grep JWT_SECRET backend/.env`
5. ✓ Is port available? `lsof -i :3000 && lsof -i :3001`

### Check Configuration

```bash
# Backend configuration
cd backend && cat .env | grep -E "DATABASE|REDIS|JWT|NODE_ENV" | head -10

# Frontend configuration
cd frontend-tenant && cat .env.local | grep NEXT_PUBLIC_API_URL

# Verify setup script
bash preflight-check.sh
```

### Enable Debug Logging

```bash
# Backend
export LOG_LEVEL=debug
cd backend && pnpm run start:dev

# Frontend
export DEBUG=*
cd frontend-tenant && pnpm run dev
```

---

## ✅ Next Steps After Setup

1. **Verify Login**
   - Visit http://localhost:3001
   - Test login workflow

2. **Explore API**
   - Visit http://localhost:3000/api/docs
   - Try sample requests

3. **Review Architecture**
   - Backend structure: `backend/src/modules/`
   - Frontend structure: `frontend-tenant/src/`

4. **Read Documentation**
   - See: `docs/ARCHITECTURE_AND_API_SPEC.md`
   - See: `backend/README.md`

5. **Make a Change**
   - Edit a component
   - See hot reload in action
   - Verify changes in browser

---

## 📊 Expected Performance

| Component             | Startup Time | Memory | CPU |
| --------------------- | ------------ | ------ | --- |
| PostgreSQL            | 2-5s         | 40MB   | Low |
| Redis                 | 1s           | 20MB   | Low |
| Backend (first run)   | 5-10s        | 250MB  | 20% |
| Backend (subsequent)  | 2-3s         | 250MB  | 5%  |
| Frontend (first run)  | 3-5s         | 300MB  | 10% |
| Frontend (subsequent) | 1-2s         | 300MB  | 2%  |

---

## 🎯 Common Tasks

### Reset Everything to Clean State

```bash
cd backend
docker-compose down -v  # Remove containers and volumes
docker-compose up -d    # Fresh containers
pnpm prisma migrate deploy
# Fresh database ready
```

### Backup Your Database

```bash
cd backend
docker exec neurecore_postgres pg_dump -U neurecore neurecore_dev > backup.sql
```

### Restore Your Database

```bash
cd backend
cat backup.sql | docker exec -i neurecore_postgres psql -U neurecore -d neurecore_dev
```

### Update Dependencies

```bash
# Backend
cd backend && pnpm update

# Frontend
cd frontend-tenant && pnpm update
```

---

🎉 **You're all set! Happy coding!**

For detailed information, see [LOCAL_DEVELOPMENT_SETUP.md](./LOCAL_DEVELOPMENT_SETUP.md)
