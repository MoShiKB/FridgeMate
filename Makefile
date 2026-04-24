# FridgeMate - Deployment Makefile
# Run `make` or `make help` to see available targets.

DEPLOY_DIR ?= /var/www/fridgemate
SERVER_DIR = server
CLIENT_DIR = client
NODE_MIN_MAJOR = 20
NODE_MIN_MINOR = 19

.PHONY: help install build build-server build-client \
        deploy deploy-client start stop restart \
        logs status test clean nginx-test nginx-reload

# ── Help (default target) ────────────────────────────────────────────────────

help:
	@echo "FridgeMate Makefile"
	@echo ""
	@echo "  make install          Install deps (server + client) after checking Node"
	@echo "  make build            Build server (tsc) and client (vite)"
	@echo "  make deploy           Full deploy: install, build, copy client, PM2 start"
	@echo "  make start            Start API with PM2 (ecosystem.config.js)"
	@echo "  make stop             Stop API PM2 process"
	@echo "  make restart          Restart API PM2 process (no rebuild)"
	@echo "  make logs             Tail PM2 logs"
	@echo "  make status           PM2 status"
	@echo "  make test             Run server tests"
	@echo "  make clean            Remove build artifacts"
	@echo "  make nginx-test       sudo nginx -t"
	@echo "  make nginx-reload     Test config and reload nginx"

# ── Install ──────────────────────────────────────────────────────────────────

install: check-node
	@echo "Installing server dependencies..."
	cd $(SERVER_DIR) && npm ci
	@echo "Installing client dependencies..."
	cd $(CLIENT_DIR) && npm ci
	@echo "Done."

# ── Build ────────────────────────────────────────────────────────────────────

build-server:
	@echo "Building server..."
	cd $(SERVER_DIR) && npm run build

build-client:
	@echo "Building client..."
	cd $(CLIENT_DIR) && npm run build

build: build-server build-client

# ── Deploy ───────────────────────────────────────────────────────────────────

deploy-client:
	@echo "Deploying client to $(DEPLOY_DIR)/client/dist..."
	@test -d $(CLIENT_DIR)/dist || (echo "ERROR: $(CLIENT_DIR)/dist not found. Run 'make build-client' first." && exit 1)
	sudo mkdir -p $(DEPLOY_DIR)/client
	sudo rm -rf $(DEPLOY_DIR)/client/dist
	sudo cp -r $(CLIENT_DIR)/dist $(DEPLOY_DIR)/client/dist
	@echo "Client deployed."

deploy: install build deploy-client start
	@echo ""
	@echo "FridgeMate deployed successfully."
	@echo "  Frontend: https://node51.cs.colman.ac.il"
	@echo "  Backend:  https://node51.cs.colman.ac.il/api/"
	@echo "  Swagger:  https://node51.cs.colman.ac.il/api/api-docs"

# ── PM2 ──────────────────────────────────────────────────────────────────────

start:
	@echo "Starting server with PM2..."
	-pm2 delete fridgemate-api 2>/dev/null
	cd $(SERVER_DIR) && pm2 start ecosystem.config.js --env production
	pm2 save
	@echo "Server running."

stop:
	pm2 stop fridgemate-api || true
	@echo "Server stopped."

restart:
	pm2 restart fridgemate-api
	@echo "Server restarted."

logs:
	pm2 logs fridgemate-api

status:
	pm2 status

# ── Utilities ────────────────────────────────────────────────────────────────

test:
	@echo "Running server tests..."
	cd $(SERVER_DIR) && npm test

clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(SERVER_DIR)/dist
	rm -rf $(CLIENT_DIR)/dist
	@echo "Clean."

nginx-test:
	sudo nginx -t

nginx-reload:
	sudo nginx -t && sudo systemctl reload nginx
	@echo "Nginx reloaded."
