#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NeureCore Local Development - Pre-Flight Checklist
# ═══════════════════════════════════════════════════════════════════════════
# 
# This script performs a complete pre-flight check before starting services
# Verifies: prerequisites, dependencies, database, configuration, and build status
#
# Exit codes:
# 0 = All checks passed, ready to start
# 1 = Some checks failed, see details
# 2 = Critical checks failed, cannot proceed
#
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0
CRITICAL=0

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

log_critical() {
    echo -e "${RED}⚠ CRITICAL${NC} $1"
    ((CRITICAL++))
}

log_section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend-tenant"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  NeureCore Local Development - Pre-Flight Checklist         ║"
echo "║  $(date '+%Y-%m-%d %H:%M:%S')                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# ═══════════════════════════════════════════════════════════════════════════
# 1. PREREQUISITES
# ═══════════════════════════════════════════════════════════════════════════

log_section "1. PREREQUISITES"

# Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d',' -f1)
    log_pass "Docker installed: $DOCKER_VERSION"
else
    log_critical "Docker not found - required to run databases"
fi

# Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version 2>/dev/null | cut -d',' -f1)
    log_pass "Docker Compose installed: $COMPOSE_VERSION"
else
    log_fail "Docker Compose not found"
fi

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        log_pass "Node.js installed: $NODE_VERSION (v18+ required)"
    else
        log_fail "Node.js version too old: $NODE_VERSION (v18+ required)"
    fi
else
    log_critical "Node.js not found"
fi

# pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    log_pass "pnpm installed: v$PNPM_VERSION"
else
    log_fail "pnpm not found (required package manager)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 2. DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

log_section "2. DEPENDENCIES"

# Backend node_modules
if [ -d "$BACKEND_DIR/node_modules" ]; then
    MODULES_SIZE=$(du -sh "$BACKEND_DIR/node_modules" 2>/dev/null | cut -f1)
    log_pass "Backend dependencies installed ($MODULES_SIZE)"
else
    log_warn "Backend node_modules not found - will need to run 'pnpm install'"
fi

# Frontend node_modules
if [ -d "$FRONTEND_DIR/node_modules" ]; then
    MODULES_SIZE=$(du -sh "$FRONTEND_DIR/node_modules" 2>/dev/null | cut -f1)
    log_pass "Frontend-tenant dependencies installed ($MODULES_SIZE)"
else
    log_warn "Frontend-tenant node_modules not found - will need to run 'pnpm install'"
fi

# Prisma Client generated
if [ -d "$BACKEND_DIR/node_modules/.prisma/client" ]; then
    log_pass "Prisma Client generated"
else
    log_warn "Prisma Client not generated - will generate on first run"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 3. ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

log_section "3. ENVIRONMENT CONFIGURATION"

# Backend .env
if [ -f "$BACKEND_DIR/.env" ]; then
    log_pass "Backend .env file exists"
    
    # Check JWT_SECRET
    if grep -q "^JWT_SECRET=" "$BACKEND_DIR/.env"; then
        JWT_SECRET=$(grep "^JWT_SECRET=" "$BACKEND_DIR/.env" | cut -d'=' -f2)
        if [ ${#JWT_SECRET} -ge 32 ]; then
            log_pass "JWT_SECRET configured (${#JWT_SECRET} chars)"
        else
            log_critical "JWT_SECRET too short (${#JWT_SECRET} chars, min 32)"
        fi
    else
        log_critical "JWT_SECRET not configured in .env"
    fi
    
    # Check NODE_ENV
    if grep -q "^NODE_ENV=development" "$BACKEND_DIR/.env"; then
        log_pass "NODE_ENV set to development"
    else
        log_warn "NODE_ENV may not be set to development"
    fi
    
    # Check DATABASE_URL
    if grep -q "^DATABASE_URL=" "$BACKEND_DIR/.env"; then
        log_pass "DATABASE_URL configured"
    else
        log_warn "DATABASE_URL not configured"
    fi
    
    # Check REDIS_URL
    if grep -q "^REDIS_URL=" "$BACKEND_DIR/.env"; then
        log_pass "REDIS_URL configured"
    else
        log_warn "REDIS_URL not configured"
    fi
else
    log_critical "Backend .env file not found"
fi

# Frontend .env.local
if [ -f "$FRONTEND_DIR/.env.local" ]; then
    log_pass "Frontend-tenant .env.local file exists"
    
    # Check API URL
    if grep -q "NEXT_PUBLIC_API_URL=" "$FRONTEND_DIR/.env.local"; then
        API_URL=$(grep "NEXT_PUBLIC_API_URL=" "$FRONTEND_DIR/.env.local" | cut -d'=' -f2)
        log_pass "NEXT_PUBLIC_API_URL configured: $API_URL"
    else
        log_warn "NEXT_PUBLIC_API_URL not configured"
    fi
else
    log_warn "Frontend-tenant .env.local file not found"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 4. DOCKER SERVICES (IF RUNNING)
# ═══════════════════════════════════════════════════════════════════════════

log_section "4. DOCKER SERVICES"

# Check if containers are running
POSTGRES_RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c neurecore_postgres || true)
REDIS_RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c neurecore_redis || true)

if [ "$POSTGRES_RUNNING" -gt 0 ]; then
    log_pass "PostgreSQL container is running"
    
    # Test connection
    if docker exec neurecore_postgres pg_isready -U neurecore -d neurecore_dev &>/dev/null; then
        log_pass "PostgreSQL is responding to queries"
    else
        log_fail "PostgreSQL is running but not responding"
    fi
else
    log_warn "PostgreSQL container is not running (will start on demand)"
fi

if [ "$REDIS_RUNNING" -gt 0 ]; then
    log_pass "Redis container is running"
    
    # Test connection
    if docker exec neurecore_redis redis-cli ping &>/dev/null; then
        log_pass "Redis is responding to commands"
    else
        log_fail "Redis is running but not responding"
    fi
else
    log_warn "Redis container is not running (will start on demand)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 5. BUILD STATUS
# ═══════════════════════════════════════════════════════════════════════════

log_section "5. BUILD STATUS"

# Backend dist
if [ -d "$BACKEND_DIR/dist" ] && [ -f "$BACKEND_DIR/dist/src/main.js" ]; then
    log_pass "Backend compiled (dist/ exists)"
else
    log_warn "Backend not compiled - will build on startup"
fi

# Frontend .next
if [ -d "$FRONTEND_DIR/.next" ]; then
    log_pass "Frontend cached build found (.next/ exists)"
else
    log_warn "Frontend not built - will build on startup"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 6. CONNECTIVITY TESTS
# ═══════════════════════════════════════════════════════════════════════════

log_section "6. CONNECTIVITY TESTS"

# Check if ports are available
check_port() {
    local PORT=$1
    local SERVICE=$2
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warn "$SERVICE port $PORT is already in use"
    else
        log_pass "$SERVICE port $PORT is available"
    fi
}

check_port 3000 "Backend"
check_port 3001 "Frontend"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# ═══════════════════════════════════════════════════════════════════════════
# 7. DISK SPACE
# ═══════════════════════════════════════════════════════════════════════════

log_section "7. DISK SPACE"

AVAILABLE=$(df "$SCRIPT_DIR" | tail -n1 | awk '{print $4}')
AVAILABLE_GB=$((AVAILABLE / 1024 / 1024))

if [ "$AVAILABLE_GB" -gt 2 ]; then
    log_pass "Sufficient disk space available: ${AVAILABLE_GB}GB"
else
    log_warn "Low disk space available: ${AVAILABLE_GB}GB (recommended 2GB+)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

log_section "SUMMARY"

echo -e "✓ Passed:   ${GREEN}$PASSED${NC}"
echo -e "⚠ Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "✗ Failed:   ${RED}$FAILED${NC}"
echo -e "⚠ Critical: ${RED}$CRITICAL${NC}"
echo ""

if [ "$CRITICAL" -gt 0 ]; then
    echo -e "${RED}✗ CRITICAL ISSUES FOUND${NC}"
    echo "Please fix critical issues before proceeding."
    echo ""
    echo "Recommended steps:"
    echo "  1. Install Docker Desktop"
    echo "  2. Install Node.js v18+ if needed"
    echo "  3. Run: bash setup-local-dev.sh start"
    exit 2
elif [ "$FAILED" -gt 0 ]; then
    echo -e "${YELLOW}⚠ SOME ISSUES FOUND${NC}"
    echo "System may work but issues should be addressed."
    echo ""
    echo "Recommended steps:"
    echo "  1. Run: bash setup-local-dev.sh install"
    echo "  2. Run: bash setup-local-dev.sh db:start"
    echo "  3. Run: bash setup-local-dev.sh db:migrate"
    exit 1
else
    echo -e "${GREEN}✓ ALL CHECKS PASSED!${NC}"
    echo "System is ready to start development services."
    echo ""
    echo "Next steps:"
    echo "  1. Start Docker services: bash setup-local-dev.sh db:start"
    echo "  2. Backend:  cd backend && pnpm run start:dev"
    echo "  3. Frontend: cd frontend-tenant && pnpm run dev"
    echo ""
    echo "Access points:"
    echo "  • Frontend:           http://localhost:3001"
    echo "  • Backend API:        http://localhost:3000/api/v1"
    echo "  • API Documentation: http://localhost:3000/api/docs"
    exit 0
fi
