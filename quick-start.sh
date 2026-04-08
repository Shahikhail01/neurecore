#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NeureCore Quick Start - Minimal Setup
# ═══════════════════════════════════════════════════════════════════════════
# This script quickly starts local development with Docker workarounds

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_section() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n${BLUE}$1${NC}\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

log_section "NeureCore Local Development - Quick Start"

# 1. Stop any existing containers
log_info "Cleaning up existing containers..."
docker stop neurecore_postgres neurecore_redis neurecore_pgvector 2>/dev/null || true
docker rm neurecore_postgres neurecore_redis neurecore_pgvector 2>/dev/null || true

# 2. Start PostgreSQL
log_info "Starting PostgreSQL..."
docker run -d \
    --name neurecore_postgres \
    -e POSTGRES_USER=neurecore \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=neurecore_dev \
    -p 5432:5432 \
    -v postgres_data:/var/lib/postgresql/data \
    --health-cmd="pg_isready -U neurecore -d neurecore_dev" \
    --health-interval=5s \
    --health-timeout=5s \
    --health-retries=5 \
    postgres:16-alpine

# 3. Start Redis
log_info "Starting Redis..."
docker run -d \
    --name neurecore_redis \
    -p 6379:6379 \
    --health-cmd="redis-cli ping" \
    --health-interval=5s \
    --health-timeout=5s \
    --health-retries=5 \
    redis:7-alpine

# 4. Wait for services to be healthy
log_info "Waiting for services to be ready..."
sleep 5

# 5. Check PostgreSQL
log_info "Checking PostgreSQL..."
if docker exec neurecore_postgres pg_isready -U neurecore -d neurecore_dev &>/dev/null; then
    log_success "PostgreSQL is ready"
else
    log_error "PostgreSQL failed to start"
    docker logs neurecore_postgres
    exit 1
fi

# 6. Check Redis
log_info "Checking Redis..."
if docker exec neurecore_redis redis-cli ping &>/dev/null; then
    log_success "Redis is ready"
else
    log_error "Redis failed to start"
    docker logs neurecore_redis
    exit 1
fi

# 7. Run migrations
log_info "Running database migrations..."
cd "$BACKEND_DIR"
if ! pnpm prisma migrate deploy 2>/dev/null; then
    log_error "Migration failed, trying db push..."
    if ! pnpm prisma db push 2>/dev/null; then
        log_error "Database setup failed"
        exit 1
    fi
fi

log_success "Migrations completed"

log_section "✅ Setup Complete!"

echo "Your development environment is ready!"
echo ""
echo "Next steps:"
echo ""
echo "📦 Terminal 1 - Start Backend:"
echo "   cd $BACKEND_DIR"
echo "   pnpm run start:dev"
echo ""
echo "📦 Terminal 2 - Start Frontend:"
echo "   cd $SCRIPT_DIR/frontend-tenant"
echo "   pnpm run dev"
echo ""
echo "📍 Access Points:"
echo "   Frontend:        http://localhost:3001"
echo "   Backend API:     http://localhost:3000/api/v1"
echo "   API Docs:        http://localhost:3000/api/docs"
echo ""
