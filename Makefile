.PHONY: help assets verify-assets clean build build-for build-all docker-build docker-push version

# =============================================================================
# Variables
# =============================================================================
APP_NAME := linksnapper
DOCKER_USER := tanq16

# Build variables (set by CI or use defaults)
VERSION ?= dev-build
GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)

# Asset versions - update as needed
LUCIDE_VERSION := 1.27.0
INTER_VERSION := 5.3.0
FONTAWESOME_VERSION := 7.3.1
DEVICON_VERSION := 2.16.0
NERD_FONTS_WOFF2_REF := e992e56ad83e

# Directories
STATIC_DIR := internal/server/static
JS_DIR := $(STATIC_DIR)/js
CSS_DIR := $(STATIC_DIR)/css
FONTS_DIR := $(STATIC_DIR)/fonts
FA_DIR := $(STATIC_DIR)/fontawesome
FA_CDN := https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@$(FONTAWESOME_VERSION)
INTER_CDN := https://cdn.jsdelivr.net/fontsource/fonts/inter@$(INTER_VERSION)
JB_NF_BASE := https://raw.githubusercontent.com/Nick2bad4u/nerd-fonts-woff2/$(NERD_FONTS_WOFF2_REF)/fonts/woff2/JetBrainsMono/Ligatures

# Console colors
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

# =============================================================================
# Help
# =============================================================================
help: ## Show this help
	@echo "$(CYAN)Available targets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

.DEFAULT_GOAL := help

# =============================================================================
# Assets
# =============================================================================
assets: ## Download static assets (JS, CSS, fonts)
	@echo "$(CYAN)Downloading assets...$(NC)"
	@mkdir -p $(JS_DIR) $(CSS_DIR) $(FONTS_DIR) $(FA_DIR)/css $(FA_DIR)/webfonts
	@curl -sL "https://cdn.tailwindcss.com" -o "$(JS_DIR)/tailwindcss.js"
	@curl -sL "https://unpkg.com/lucide@$(LUCIDE_VERSION)/dist/umd/lucide.min.js" -o "$(JS_DIR)/lucide.min.js"
	@curl -sL "$(FA_CDN)/css/all.min.css" -o "$(FA_DIR)/css/all.min.css"
	@for font in fa-brands-400 fa-regular-400 fa-solid-900 fa-v4compatibility; do \
		curl -sL "$(FA_CDN)/webfonts/$$font.woff2" -o "$(FA_DIR)/webfonts/$$font.woff2"; \
	done
	@sed -i.bak 's|url(../webfonts/|url(/static/fontawesome/webfonts/|g' "$(FA_DIR)/css/all.min.css" && rm -f "$(FA_DIR)/css/all.min.css.bak"
	@# Drop TTF fallbacks so only WOFF2 is served
	@sed -i.bak -E 's|,?\s*url\(/static/fontawesome/webfonts/[^)]+\.ttf\)\s*format\("truetype"\)||g' "$(FA_DIR)/css/all.min.css" && rm -f "$(FA_DIR)/css/all.min.css.bak"
	@curl -sL "https://cdn.jsdelivr.net/gh/devicons/devicon@$(DEVICON_VERSION)/devicon.min.css" -o "$(CSS_DIR)/devicon.min.css"
	@for weight in 400 500 600 700 800; do \
		curl -sL "$(INTER_CDN)/latin-$$weight-normal.woff2" -o "$(FONTS_DIR)/inter-$$weight.woff2"; \
	done
	@printf '%s\n' \
		"@font-face {" \
		"    font-family: 'Inter';" \
		"    font-style: normal;" \
		"    font-weight: 400;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/inter-400.woff2') format('woff2');" \
		"}" \
		"" \
		"@font-face {" \
		"    font-family: 'Inter';" \
		"    font-style: normal;" \
		"    font-weight: 500;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/inter-500.woff2') format('woff2');" \
		"}" \
		"" \
		"@font-face {" \
		"    font-family: 'Inter';" \
		"    font-style: normal;" \
		"    font-weight: 600;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/inter-600.woff2') format('woff2');" \
		"}" \
		"" \
		"@font-face {" \
		"    font-family: 'Inter';" \
		"    font-style: normal;" \
		"    font-weight: 700;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/inter-700.woff2') format('woff2');" \
		"}" \
		"" \
		"@font-face {" \
		"    font-family: 'Inter';" \
		"    font-style: normal;" \
		"    font-weight: 800;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/inter-800.woff2') format('woff2');" \
		"}" > "$(CSS_DIR)/inter.css"
	@curl -sL "$(JB_NF_BASE)/Regular/JetBrainsMonoNerdFontMono-Regular.woff2" -o "$(FONTS_DIR)/JetBrainsMonoNerdFontMono-Regular.woff2"
	@curl -sL "$(JB_NF_BASE)/Bold/JetBrainsMonoNerdFontMono-Bold.woff2" -o "$(FONTS_DIR)/JetBrainsMonoNerdFontMono-Bold.woff2"
	@printf '%s\n' \
		"@font-face {" \
		"    font-family: 'JetBrains Mono';" \
		"    font-style: normal;" \
		"    font-weight: 400;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/JetBrainsMonoNerdFontMono-Regular.woff2') format('woff2');" \
		"}" \
		"" \
		"@font-face {" \
		"    font-family: 'JetBrains Mono';" \
		"    font-style: normal;" \
		"    font-weight: 700;" \
		"    font-display: swap;" \
		"    src: url('/static/fonts/JetBrainsMonoNerdFontMono-Bold.woff2') format('woff2');" \
		"}" > "$(CSS_DIR)/jetbrains-mono.css"
	@echo "$(GREEN)Assets downloaded$(NC)"

verify-assets: ## Verify required assets exist
	@test -f $(JS_DIR)/tailwindcss.js || (echo "$(YELLOW)tailwindcss.js missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(JS_DIR)/lucide.min.js || (echo "$(YELLOW)lucide.min.js missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(FA_DIR)/css/all.min.css || (echo "$(YELLOW)fontawesome css missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(FA_DIR)/webfonts/fa-solid-900.woff2 || (echo "$(YELLOW)fontawesome woff2 missing. Run 'make assets'$(NC)" && exit 1)
	@! find $(FA_DIR)/webfonts $(FONTS_DIR) -name '*.ttf' 2>/dev/null | grep -q . || (echo "$(YELLOW)TTF fonts found; use WOFF2 only$(NC)" && exit 1)
	@test -f $(CSS_DIR)/devicon.min.css || (echo "$(YELLOW)devicon.min.css missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(CSS_DIR)/inter.css || (echo "$(YELLOW)inter.css missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(FONTS_DIR)/inter-400.woff2 || (echo "$(YELLOW)Inter woff2 missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(CSS_DIR)/jetbrains-mono.css || (echo "$(YELLOW)jetbrains-mono.css missing. Run 'make assets'$(NC)" && exit 1)
	@test -f $(FONTS_DIR)/JetBrainsMonoNerdFontMono-Regular.woff2 || (echo "$(YELLOW)JetBrains Mono Nerd Font missing. Run 'make assets'$(NC)" && exit 1)
	@echo "$(GREEN)Assets verified$(NC)"

clean: ## Remove built artifacts and downloaded assets
	@rm -f $(APP_NAME) $(APP_NAME)-*
	@rm -rf $(JS_DIR)/*.js $(CSS_DIR)/*.css $(FONTS_DIR)/*.ttf $(FONTS_DIR)/*.woff2 $(FA_DIR)
	@echo "$(GREEN)Cleaned$(NC)"

# =============================================================================
# Build
# =============================================================================
build: assets verify-assets ## Build binary for current platform
	@go build -ldflags="-s -w -X 'github.com/tanq16/linksnapper/cmd.AppVersion=$(VERSION)'" -o $(APP_NAME) .
	@echo "$(GREEN)Built: ./$(APP_NAME)$(NC)"

build-for: verify-assets ## Build binary for specified GOOS/GOARCH
	@CGO_ENABLED=0 GOOS=$(GOOS) GOARCH=$(GOARCH) go build -ldflags="-s -w -X 'github.com/tanq16/linksnapper/cmd.AppVersion=$(VERSION)'" -o $(APP_NAME)-$(GOOS)-$(GOARCH) .
	@echo "$(GREEN)Built: ./$(APP_NAME)-$(GOOS)-$(GOARCH)$(NC)"

build-all: assets verify-assets ## Build all platform binaries
	@$(MAKE) build-for GOOS=linux GOARCH=amd64
	@$(MAKE) build-for GOOS=linux GOARCH=arm64
	@$(MAKE) build-for GOOS=darwin GOARCH=amd64
	@$(MAKE) build-for GOOS=darwin GOARCH=arm64

# =============================================================================
# Docker
# =============================================================================
docker-build: ## Build Docker image
	@docker build --build-arg VERSION=$(VERSION) -t $(DOCKER_USER)/$(APP_NAME):$(VERSION) .
	@docker tag $(DOCKER_USER)/$(APP_NAME):$(VERSION) $(DOCKER_USER)/$(APP_NAME):latest
	@echo "$(GREEN)Docker image built$(NC)"

docker-push: docker-build ## Push Docker image to Docker Hub
	@docker push $(DOCKER_USER)/$(APP_NAME):$(VERSION)
	@docker push $(DOCKER_USER)/$(APP_NAME):latest
	@echo "$(GREEN)Docker image pushed$(NC)"

# =============================================================================
# Version
# =============================================================================
version: ## Calculate next version from commit message
	@LATEST_TAG=$$(git tag --sort=-v:refname | head -n1 || echo "0.0.0"); \
	LATEST_TAG=$${LATEST_TAG#v}; \
	MAJOR=$$(echo "$$LATEST_TAG" | cut -d. -f1); \
	MINOR=$$(echo "$$LATEST_TAG" | cut -d. -f2); \
	PATCH=$$(echo "$$LATEST_TAG" | cut -d. -f3); \
	MAJOR=$${MAJOR:-0}; MINOR=$${MINOR:-0}; PATCH=$${PATCH:-0}; \
	COMMIT_MSG="$$(git log -1 --pretty=%B)"; \
	if echo "$$COMMIT_MSG" | grep -q "\[major-release\]"; then \
		MAJOR=$$((MAJOR + 1)); MINOR=0; PATCH=0; \
	elif echo "$$COMMIT_MSG" | grep -q "\[minor-release\]"; then \
		MINOR=$$((MINOR + 1)); PATCH=0; \
	else \
		PATCH=$$((PATCH + 1)); \
	fi; \
	echo "v$${MAJOR}.$${MINOR}.$${PATCH}"
