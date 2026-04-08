#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NeureCore Local Development Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# 
# This script sets up the NeureCore platform for local development:
# - Backend (NestJS) on port 3000
# - Frontend-Tenant (Next.js) on port 3001
# - PostgreSQL database
# - Redis cache
#
# Prerequisites:
# - Docker & Docker Compose installed
# - Node.js 18+ and pnpm installed
# - ~2GB free disk space
#
# Usage:
#   bash setup-local-dev.sh [command]
#
# Commands:
#   install       Install all dependencies
#   db:start      Start Docker containers (PostgreSQL, Redis)
#   db:migrate    Run Prisma migrations
#   db:seed       Seed database with sample data
#   backend:dev   Start backend in development mode
#   frontend:dev  Start frontend in development mode
#   start         Start all services (full setup)
#   stop          Stop all running services
#   clean         Clean up and reset environment
#
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script settings
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend-tenant"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}\n"
}

# Docker Compose wrapper (handles compatibility issues)
run_docker_compose() {
    local compose_cmd=(docker-compose)
    
    # Try to use newer docker compose if available
    if docker compose version &>/dev/null 2>&1; then
        compose_cmd=(docker compose)
    fi
    
    # Execute the command
    if ! "${compose_cmd[@]}" "$@" 2>&1; then
        # If docker-compose fails with the ssl_version error, try using Python fix
        local error_msg="$("${compose_cmd[@]}" "$@" 2>&1 || true)"
        if echo "$error_msg" | grep -q "ssl_version"; then
            log_warn "Docker Compose has compatibility issue, using manual docker commands..."
            return 1
        fi
        return 1
    fi
    return 0
}

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    local missing=0
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker Desktop"
        missing=1
    else
        log_success "Docker found: $(docker --version)"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose not found. Please install Docker Compose"
        missing=1
    else
        log_success "Docker Compose found: $(docker-compose --version)"
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+"
        missing=1
    else
        log_success "Node.js found: $(node --version)"
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm not found. Installing: npm install -g pnpm"
        npm install -g pnpm
    else
        log_success "pnpm found: $(pnpm --version)"
    fi
    
    if [ $missing -eq 1 ]; then
        log_error "Please install missing prerequisites and try again"
        exit 1
    fi
}

# Install dependencies
install_deps() {
    log_section "Installing Dependencies"
    
    log_info "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    pnpm install
    if [ -f pnpm-lock.yaml ]; then
        log_success "Backend dependencies installed"
    fi
    
    log_info "Installing frontend-tenant dependencies..."
    cd "$FRONTEND_DIR"
    pnpm install
    if [ -f pnpm-lock.yaml ]; then
        log_success "Frontend-tenant dependencies installed"
    fi
    
    cd "$SCRIPT_DIR"
}

# Start Docker services
start_docker_services() {
    log_section "Starting Docker Services (PostgreSQL, Redis)"
    
    if docker ps -a --format '{{.Names}}' | grep -E "neurecore_postgres|neurecore_redis" > /dev/null 2>&1; then
        log_info "Stopping existing containers..."
        cd "$BACKEND_DIR"
        run_docker_compose -f "$BACKEND_DIR/docker-compose.yml" down -v 2>/dev/null || true
        sleep 2
    fi
    
    log_info "Starting Docker services..."
    cd "$BACKEND_DIR"
    
    # Try docker-compose first, if it fails due to ssl_version, use manual docker
    if ! run_docker_compose up -d 2>/dev/null; then
        log_warn "docker-compose has compatibility issue, starting containers manually..."
        
        # Start PostgreSQL
        docker run -d \
            --name neurecore_postgres \
            -e POSTGRES_USER=neurecore \
            -e POSTGRES_PASSWORD=password \
            -e POSTGRES_DB=neurecore_dev \
            -p 5432:5432 \
            -v postgres_data:/var/lib/postgresql/data \
            postgres:16-alpine || true
        
        # Start Redis
        docker run -d \
            --name neurecore_redis \
            -p 6379:6379 \
            redis:7-alpine || true
        
        log_info "Containers started manually"
    fi
    
    log_info "Waiting for services to be healthy..."
    sleep 5
    
    # Check PostgreSQL
    if docker exec neurecore_postgres pg_isready -U neurecore -d neurecore_dev &>/dev/null; then
        log_success "PostgreSQL is ready"
    else
        log_error "PostgreSQL failed to start"
        docker logs neurecore_postgres 2>&1 | tail -20
        exit 1
    fi
    
    # Check Redis
    if docker exec neurecore_redis redis-cli ping &>/dev/null; then
        log_success "Redis is ready"
    else
        log_error "Redis failed to start"
        docker logs neurecore_redis 2>&1 | tail -20
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Run Prisma migrations
run_migrations() {
    log_section "Running Database Migrations"
    
    cd "$BACKEND_DIR"
    
    log_info "Updating .env for local development..."
    # Backup original .env
    cp .env .env.backup || true
    
    # Update DATABASE_URL to use local PostgreSQL
    sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL=postgresql://neurecore:password@localhost:5432/neurecore_dev|g' .env || true
    
    # Update REDIS_URL to use local Redis
    sed -i.bak 's|REDIS_URL=.*|REDIS_URL=redis://localhost:6379|g' .env || true
    
    log_info "Running Prisma migrations..."
    pnpm prisma migrate deploy || pnpm prisma db push
    
    if [ $? -eq 0 ]; then
        log_success "Database migrations completed"
    else
        log_warn "Database migration step completed (some migrations may already exist)"
    fi
    
    cd "$SCRIPT_DIR"
}

# Seed database
seed_database() {
    log_section "Seeding Database"
    
    cd "$BACKEND_DIR"
    
    if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.cjs" ]; then
        log_info "Running database seed..."
        pnpm prisma db seed
        log_success "Database seeded"
    else
        log_info "No seed file found, skipping seed step"
    fi
    
    cd "$SCRIPT_DIR"
}

# Start backend
start_backend() {
    log_section "Starting Backend Server"
    
    cd "$BACKEND_DIR"
    
    log_info "Building backend..."
    pnpm run build
    
    log_info "Starting backend on port 3000..."
    log_info "Press Ctrl+C to stop"
    pnpm run start:dev
}

# Start frontend
start_frontend() {
    log_section "Starting Frontend-Tenant"
    
    cd "$FRONTEND_DIR"
    
    log_info "Building frontend..."
    pnpm run build
    
    log_info "Starting frontend-tenant on port 3001..."
    log_info "Press Ctrl+C to stop"
    pnpm run dev
}

# Stop all services
stop_services() {
    log_section "Stopping Services"
    
    log_info "Stopping Docker services..."
    
    # Stop containers by name
    docker stop neurecore_postgres neurecore_redis neurecore_pgvector 2>/dev/null || true
    
    # Remove containers
    docker rm neurecore_postgres neurecore_redis neurecore_pgvector 2>/dev/null || true
    
    log_success "All services stopped"
}

# Clean everything
clean() {
    log_section "Cleaning Up"
    
    log_warn "This will remove all containers and volumes"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Stop and remove containers
        docker stop neurecore_postgres neurecore_redis neurecore_pgvector 2>/dev/null || true
        docker rm neurecore_postgres neurecore_redis neurecore_pgvector 2>/dev/null || true
        
        # Remove volumes
        docker volume rm postgres_data pgvector_data redis_data 2>/dev/null || true
        
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [command]

Commands:
  check           Check prerequisites only
  install         Install dependencies
  db:start        Start Docker services (PostgreSQL, Redis)
  db:migrate      Run database migrations
  db:seed         Seed database with sample data
  backend:dev     Start backend development server (port 3000)
  frontend:dev    Start frontend development server (port 3001)
  start           Full setup: check → install → db:start → migrate → build → run both
  stop            Stop Docker services
  clean           Remove all containers and volumes
  help            Show this usage information

Examples:
  # First time setup (recommended)
  bash setup-local-dev.sh start

  # Daily development
  bash setup-local-dev.sh db:start  # Start databases
  bash setup-local-dev.sh backend:dev  # In one terminal
  bash setup-local-dev.sh frontend:dev # In another terminal

  # Clean rebuild
  bash setup-local-dev.sh clean
  bash setup-local-dev.sh start

EOF
    exit 0
}

# Full setup flow
full_setup() {
    log_section "NeureCore Local Development - Full Setup"
    
    check_prerequisites
    install_deps
    start_docker_services
    run_migrations
    seed_database
    
    log_section "✓ Setup Complete!"
    echo "Next steps:"
    echo "  1. In terminal 1: cd $BACKEND_DIR && pnpm run start:dev"
    echo "  2. In terminal 2: cd $FRONTEND_DIR && pnpm run dev"
    echo ""
    echo "Access points:"
    echo "  • Backend API:        http://localhost:3000"
    echo "  • Frontend-Tenant:    http://localhost:3001"
    echo "  • API Docs (Swagger): http://localhost:3000/api/docs"
    echo ""
}

# Main script logic
case "${1:-start}" in
    check)
        check_prerequisites
        ;;
    install)
        install_deps
        ;;
    db:start)
        start_docker_services
        ;;
    db:migrate)
        run_migrations
        ;;
    db:seed)
        seed_database
        ;;
    backend:dev)
        start_backend
        ;;
    frontend:dev)
        start_frontend
        ;;
    start)
        full_setup
        # Optionally start both services
        # (Can be commented out to let user start them manually)
        log_info "To start services, run in separate terminals:"
        log_info "  Terminal 1: cd $BACKEND_DIR && pnpm run start:dev"
        log_info "  Terminal 2: cd $FRONTEND_DIR && pnpm run dev"
        ;;
    stop)
        stop_services
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        log_error "Unknown command: $1"
        show_usage
        ;;
esac
