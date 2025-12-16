.PHONY: help install dev build test clean start stop restart logs init seed

# Variables
COMPOSE=docker-compose
NPM=npm
NODE=node
TS_NODE=npx ts-node

# Default target
help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make init       - Initialize databases and storage"
	@echo "  make dev        - Start development environment"
	@echo "  make start      - Start infrastructure services"
	@echo "  make stop       - Stop infrastructure services"
	@echo "  make restart    - Restart infrastructure services"
	@echo "  make logs       - View infrastructure logs"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Clean up generated files and volumes"
	@echo "  make seed       - Seed test data"
	@echo "  make build      - Build TypeScript"

# Install dependencies
install:
	$(NPM) install

# Initialize storage and databases
init: start
	@echo "Creating storage directories..."
	@mkdir -p storage/chroma storage/sqlite storage/logs
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Initializing databases..."
	$(TS_NODE) scripts/init-db.ts
	@echo "Initialization complete!"

# Start infrastructure (without UI)
start:
	@echo "Starting infrastructure services..."
	$(COMPOSE) up -d
	@echo "Services started. Chroma available at http://localhost:8000"

# Start development environment (with UI)
dev:
	@echo "Starting development environment..."
	$(COMPOSE) --profile dev up -d
	@echo "Services started:"
	@echo "  - Chroma: http://localhost:8000"
	@echo "  - Chroma UI: http://localhost:3001"

# Stop services
stop:
	@echo "Stopping services..."
	$(COMPOSE) down

# Restart services
restart: stop start

# View logs
logs:
	$(COMPOSE) logs -f

# Run tests
test:
	$(NPM) test

# Build TypeScript
build:
	$(NPM) run build

# Clean up
clean:
	@echo "Cleaning up..."
	$(COMPOSE) down -v
	@rm -rf storage/chroma/* storage/sqlite/* storage/logs/*
	@rm -rf dist node_modules
	@echo "Cleanup complete!"

# Seed test data
seed:
	@echo "Seeding test data..."
	$(TS_NODE) scripts/seed-data.ts
	@echo "Seeding complete!"

# Check service health
health:
	@echo "Checking service health..."
	@curl -f http://localhost:8000/api/v2/heartbeat || echo "Chroma not healthy"

# Database backup
backup:
	@echo "Backing up databases..."
	@mkdir -p backups
	@cp storage/sqlite/agent.db backups/agent-$(shell date +%Y%m%d-%H%M%S).db
	@echo "Backup complete!"