# ✅ NeureCore Local Development - RUNNING!

**Date**: April 8, 2026  
**Status**: Database Services Started Successfully  
**Time**: Ready to start development servers

---

## 🎉 Database Services Are Running!

Your PostgreSQL and Redis services are now active:

```
✓ PostgreSQL    - http://localhost:5432 (neurecore:password)
✓ Redis         - http://localhost:6379
✓ Migrations    - Applied successfully (15 migrations)
```

---

## 🚀 Next Steps: Start Development Servers

### Option 1: In VS Code Terminal

**Terminal 1 - Backend:**

```bash
cd /mnt/data/Web\ Dev/NeureCore/backend
pnpm run start:dev
```

Expected output:

```
NestApplication listening on localhost:3000 with { address: 'localhost', family: 'IPv4', port: 3000 }
```

**Terminal 2 - Frontend:**

```bash
cd /mnt/data/Web\ Dev/NeureCore/frontend-tenant
pnpm run dev
```

Expected output:

```
▲ Next.js 15.5.12
- ready started server on 0.0.0.0:3001
```

### Option 2: Using Split Terminals

In your terminal:

```bash
# Start backend
cd /mnt/data/Web\ Dev/NeureCore/backend && pnpm run start:dev &

# Start frontend
cd /mnt/data/Web\ Dev/NeureCore/frontend-tenant && pnpm run dev
```

---

## 📍 Access Your Application

Once both servers are running:

| Service         | URL                            | Description           |
| --------------- | ------------------------------ | --------------------- |
| **Frontend UI** | http://localhost:3001          | Main application      |
| **Backend API** | http://localhost:3000/api/v1   | REST endpoints        |
| **API Docs**    | http://localhost:3000/api/docs | Swagger documentation |
| **Database**    | localhost:5432                 | PostgreSQL            |
| **Cache**       | localhost:6379                 | Redis                 |

---

## 📋 Quick Reference

### Stop Services

```bash
# Stop backend (Ctrl+C in terminal)
docker stop neurecore_postgres neurecore_redis

# Or use the stop command
bash /mnt/data/Web\ Dev/NeureCore/quick-start.sh
```

### View Logs

```bash
# Backend logs (running, shows in terminal)
# Frontend logs (running, shows in terminal)

# Database logs
docker logs neurecore_postgres
docker logs neurecore_redis
```

### Reset Everything

```bash
docker stop neurecore_postgres neurecore_redis
docker rm neurecore_postgres neurecore_redis
docker volume rm postgres_data

# Then re-run: bash quick-start.sh
```

---

## ✅ What's Configured

- ✅ PostgreSQL database running locally
- ✅ Redis cache running locally
- ✅ Database migrations applied
- ✅ JWT_SECRET configured and validated ✓
- ✅ CORS configured for localhost development
- ✅ Environment variables set for local development

---

## 🎯 Development Workflow

1. **Make code changes** in `backend/src/` or `frontend-tenant/src/`
2. **Watch for hot reload** (both services support auto-reload on file changes)
3. **Test in browser** at http://localhost:3001
4. **Check API docs** at http://localhost:3000/api/docs

---

## 🔧 Common Tasks

### Create Database Migration

```bash
cd /mnt/data/Web\ Dev/NeureCore/backend
pnpm prisma migrate dev --name describe_changes
```

### Run Backend Tests

```bash
cd /mnt/data/Web\ Dev/NeureCore/backend
pnpm test
```

### Run Backend Lint

```bash
cd /mnt/data/Web\ Dev/NeureCore/backend
pnpm lint
```

### Type Check Frontend

```bash
cd /mnt/data/Web\ Dev/NeureCore/frontend-tenant
pnpm type-check
```

---

## ⚠️ Issues & Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000 or 3001
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs neurecore_postgres

# Test connection
docker exec neurecore_postgres psql -U neurecore -d neurecore_dev -c "SELECT 1"
```

### Redis Connection Error

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis
docker exec neurecore_redis redis-cli ping
```

### Frontend Can't Reach Backend

1. Verify backend is running: `curl http://localhost:3000/api/v1/health`
2. Check frontend API URL: `grep NEXT_PUBLIC_API_URL frontend-tenant/.env.local`
3. Should be: `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`

---

## 📚 Documentation

- **QUICK_START.md** - Quick start guide
- **LOCAL_DEVELOPMENT_SETUP.md** - Detailed setup & troubleshooting
- **SETUP_COMPLETE.md** - Setup verification checklist
- **Backend API Docs** - http://localhost:3000/api/docs (when running)

---

## 🎉 Ready to Develop!

Your environment is fully configured. Start the development servers and begin coding!

```bash
# Terminal 1: Backend
cd backend && pnpm run start:dev

# Terminal 2: Frontend
cd frontend-tenant && pnpm run dev
```

Visit **http://localhost:3001** to see your application!

---

**Generated**: April 8, 2026 | **Status**: Ready ✓
