.PHONY: help install typecheck dev deploy kv-create secret-webhook secret-seed secrets backfill status logs clean

help: ## Show this help
	@echo "caseonix-status — Worker for the hero Live Status widget"
	@echo ""
	@echo "Day-to-day:"
	@echo "  make install         Install deps"
	@echo "  make typecheck       Typecheck worker + scripts"
	@echo "  make dev             Local wrangler dev server"
	@echo "  make deploy          Deploy Worker to Cloudflare"
	@echo "  make status          curl caseonix.ca/api/status (needs jq)"
	@echo "  make logs            wrangler tail"
	@echo ""
	@echo "First-time setup (run in this order):"
	@echo "  make kv-create       Create STATUS_KV namespace and patch wrangler.toml"
	@echo "  make secrets         Generate + store both secrets (see output; save them!)"
	@echo "  make deploy          Deploy"
	@echo "  export ADMIN_SEED_TOKEN=<value from 'make secrets' output>"
	@echo "  make backfill        Seed the snapshot once from the GitHub API"
	@echo ""
	@echo "Finer-grained secret targets:"
	@echo "  make secret-webhook  Generate + store GITHUB_WEBHOOK_SECRET only"
	@echo "  make secret-seed     Generate + store ADMIN_SEED_TOKEN only"

install: ## Install npm deps
	npm install

typecheck: ## tsc --noEmit across src/ and scripts/
	npm run typecheck

dev: ## Local wrangler dev
	npm run dev

deploy: ## Deploy Worker
	npm run deploy

kv-create: ## Create STATUS_KV namespace + patch wrangler.toml with the returned id
	@echo "Creating STATUS_KV namespace…"
	@OUT=$$(npx wrangler kv namespace create STATUS_KV 2>&1); \
	echo "$$OUT"; \
	ID=$$(echo "$$OUT" | grep -oE '"id": *"[a-f0-9]+"' | head -1 | grep -oE '[a-f0-9]{20,}'); \
	if [ -z "$$ID" ]; then \
	  ID=$$(echo "$$OUT" | grep -oE 'id = "[a-f0-9]+"' | head -1 | grep -oE '[a-f0-9]{20,}'); \
	fi; \
	if [ -n "$$ID" ]; then \
	  sed -i '' "s/REPLACE_WITH_KV_ID/$$ID/" wrangler.toml && \
	  echo "" && \
	  echo "✓ Patched wrangler.toml with KV id: $$ID"; \
	else \
	  echo ""; \
	  echo "⚠️  Could not auto-extract KV id from wrangler output."; \
	  echo "   Paste the id into wrangler.toml manually, replacing REPLACE_WITH_KV_ID."; \
	fi

secret-webhook: ## Generate + store GITHUB_WEBHOOK_SECRET (prints value — save it)
	@S=$$(openssl rand -hex 32); \
	echo ""; \
	echo "────────────────────────────────────────────────────────────"; \
	echo "GITHUB_WEBHOOK_SECRET (paste into each GitHub repo webhook):"; \
	echo ""; \
	echo "  $$S"; \
	echo "────────────────────────────────────────────────────────────"; \
	echo ""; \
	echo "$$S" | npx wrangler secret put GITHUB_WEBHOOK_SECRET

secret-seed: ## Generate + store ADMIN_SEED_TOKEN (prints value — save it)
	@S=$$(openssl rand -hex 32); \
	echo ""; \
	echo "────────────────────────────────────────────────────────────"; \
	echo "ADMIN_SEED_TOKEN (export before 'make backfill'):"; \
	echo ""; \
	echo "  $$S"; \
	echo "────────────────────────────────────────────────────────────"; \
	echo ""; \
	echo "$$S" | npx wrangler secret put ADMIN_SEED_TOKEN

secrets: secret-webhook secret-seed ## Generate + store both secrets

backfill: ## One-shot seed from GitHub API (needs ADMIN_SEED_TOKEN env var)
	@test -n "$$ADMIN_SEED_TOKEN" || (echo "ERROR: ADMIN_SEED_TOKEN env var not set. See 'make help'."; exit 1)
	npm run backfill

status: ## Fetch /api/status and pretty-print
	@curl -sS https://caseonix.ca/api/status | jq .

logs: ## Tail Worker logs
	npx wrangler tail

clean: ## Remove build artifacts and local state
	rm -rf node_modules .wrangler dist
