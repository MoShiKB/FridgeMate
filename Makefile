# FridgeMate - Deployment Makefile
# Usage:
#   make install    - Install all dependencies
#   make build      - Build both server and client
#   make deploy     - Full deploy (install + build + start with PM2)
#   make start      - Start/restart with PM2
#   make stop       - Stop PM2 processes
#   make logs       - View PM2 logs
#   make status     - Check PM2 status

DEPLOY_DIR ?= /var/www/fridgemate
SERVER_DIR = server
CLIENT_DIR = client

.PHONY: install build deploy start stop restart logs status clean test

# ── Install ──────────────────────────────────────────────────────────────────

install:
	@echo "📦 Installing server dependencies..."
	cd $(SERVER_DIR) && npm ci
	@echo "📦 Installing client dependencies..."
	cd $(CLIENT_DIR) && npm ci --legacy-peer-deps
	@echo "✅ Dependencies installed"

# ── Build ────────────────────────────────────────────────────────────────────

build-server:
	@echo "🔨 Building server..."
	cd $(SERVER_DIR) && npm run build
	@echo "✅ Server built → $(SERVER_DIR)/dist/"

build-client:
	@echo "🔨 Building client..."
	cd $(CLIENT_DIR) && npm run build
	@echo "✅ Client built → $(CLIENT_DIR)/build/"

build: build-server build-client

# ── Deploy ───────────────────────────────────────────────────────────────────

deploy-client:
	@echo "🚀 Deploying client to $(DEPLOY_DIR)/client/..."
	sudo mkdir -p $(DEPLOY_DIR)/client
	sudo rm -rf $(DEPLOY_DIR)/client/build
	sudo cp -r $(CLIENT_DIR)/build $(DEPLOY_DIR)/client/build
	@echo "✅ Client deployed"

deploy: install build deploy-client start
	@echo ""
	@echo "🎉 FridgeMate deployed successfully!"
	@echo "   Frontend: https://node51.cs.colman.ac.il"
	@echo "   Backend:  https://node51.cs.colman.ac.il/api/"
	@echo "   Swagger:  https://node51.cs.colman.ac.il/api/api-docs"

# ── PM2 ──────────────────────────────────────────────────────────────────────

start:
	@echo "🚀 Starting server with PM2..."
	cd $(SERVER_DIR) && NODE_ENV=production pm2 start dist/index.js \
		--name "fridgemate-api" \
		--update-env \
		|| cd $(SERVER_DIR) && pm2 restart fridgemate-api --update-env
	pm2 save
	@echo "✅ Server running"

stop:
	pm2 stop fridgemate-api || true
	@echo "🛑 Server stopped"

restart:
	cd $(SERVER_DIR) && pm2 restart fridgemate-api --update-env
	@echo "🔄 Server restarted"

logs:
	pm2 logs fridgemate-api

status:
	pm2 status

# ── Utilities ────────────────────────────────────────────────────────────────

test:
	@echo "🧪 Running server tests..."
	cd $(SERVER_DIR) && npm test

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf $(SERVER_DIR)/dist
	rm -rf $(CLIENT_DIR)/build
	@echo "✅ Clean"

nginx-test:
	sudo nginx -t

nginx-reload:
	sudo nginx -t && sudo systemctl reload nginx
	@echo "✅ Nginx reloaded"
