<p align="center">
<img src="/assets/logo.png" alt="LinkSnapper Logo" width=250px /><br>
<h1 align="center">LinkSnapper</h1><br>

<p align="center">
<a href="https://github.com/tanq16/linksnapper/actions/workflows/release.yaml"><img src="https://github.com/tanq16/linksnapper/actions/workflows/release.yaml/badge.svg" alt="Release Build"></a>&nbsp;<a href="https://github.com/Tanq16/linksnapper/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/tanq16/linksnapper"></a>&nbsp;<a href="https://hub.docker.com/r/tanq16/linksnapper"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/tanq16/linksnapper"></a>
</p>
</p>

`LinkSnapper` is a sleek and minimalist bookmark manager for homelab use. It keeps quick-access bookmarks and a saved-link library as separate surfaces, with hierarchical categories and a Catppuccin Mocha UI. Available as multi-platform binaries and a multi-architecture container image.

---

- [Motivation](#motivation)
- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Tips and Notes](#tips-and-notes)

# Motivation

There are numerous bookmark managers available, and they're great. My personal favorites are Karakeep and Linkwarden. I also wanted a significantly simpler format of links to create a shareable repository from my bookmarks. LinkSnapper was created to be that lightweight, no-nonsense bookmark manager that just works.

# Features

### Core Functionality

- Two separate surfaces: **Bookmarks** (quick-access destinations) and **Resources** (saved link library)
- Pill navigation for Bookmarks / Resources / Settings (Bookmarks is the default)
- Inline bookmark CRUD with slash-path folders (`Homelab/Infra`), Lucide icon picker, and Catppuccin color swatches
- Multi-level path-based categories for resources, with fuzzy word search across name, description, URL, and path
- Settings page for import/export of resources and bookmarks (JSON), About, and a backups placeholder
- Clean Catppuccin Mocha UI powered by Tailwind CSS
- Flat file storage: `data/links.json` for resources, `data/bookmarks.yaml` for bookmarks

### Organization

1. Bookmarks — nested categories/folders for desktop-friendly quick links; empty folders self-clean on write
2. Resources — hierarchical path tree plus dense rows with health status
3. Settings — portable JSON import/export for both datasets

# Screenshots

| Desktop View | Mobile View |
| --- | --- |
| <img src="/assets/d.png" alt="Desktop" /> | <img src="/assets/m.png" alt="Mobile" /> |

# Installation

### Docker Installation (Recommended)

```bash
docker pull tanq16/linksnapper:main
```

```bash
docker run -d \
--name linksnapper \
-p 8080:8080 \
-v linksnapper_data:/app/data \
tanq16/linksnapper:main
```

To use it with Docker compose or a container-management system like Portainer or Dockge, use this YAML definition:

```yaml
version: "3.8"
services:
  linksnapper:
    image: tanq16/linksnapper:main
    restart: unless-stopped
    ports:
      - 8080:8080
    volumes:
      - /home/user/linksnapper:/app/data # CHANGE DIR
```

### Binary & Building from Source

You can download the required binary for your system from the project releases. If you want to build yourself, do the following:

```bash
git clone https://github.com/tanq16/linksnapper.git && \
cd linksnapper && \
make build
# or: go build .
```

This produces a `linksnapper` binary. Run it with:

```bash
./linksnapper serve
```

# Usage

Access the web interface through your browser at `http://localhost:8080/`

> [!NOTE]
> This app has no authentication, so deploy carefully. It works well with a reverse proxy like Nginx Proxy Manager and is mainly intended for homelab use.

### `linksnapper serve`

Starts the web server:

```bash
linksnapper serve -p 8080 -H 0.0.0.0 -d ./data
```

**Flags:**
- `-p, --port` - Port to listen on (default: `8080`)
- `-H, --host` - Host to bind to (default: `0.0.0.0`)
- `-d, --data` - Data directory for storage (default: `data`)

### REST API

**Resources (`links.json`)**

```bash
# List / create
curl http://localhost:8080/api/links
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","name":"Example","description":"…","path":["Tech","Go"]}'

# Update / delete
curl -X PUT http://localhost:8080/api/links/{id} -H "Content-Type: application/json" -d '{…}'
curl -X DELETE http://localhost:8080/api/links/{id}

# Import (mode=merge|replace; default merge). Body may be [] or {"links":[],"mode":"merge"}
curl -X POST 'http://localhost:8080/api/links/import?mode=merge' \
  -H "Content-Type: application/json" \
  -d '{"links":[{"url":"https://example.com","name":"Example","path":["Tech"]}]}'
```

**Bookmarks (`bookmarks.yaml`)**

```bash
# List / create (folder is A or A/B)
curl http://localhost:8080/api/bookmarks
curl -X POST http://localhost:8080/api/bookmarks \
  -H "Content-Type: application/json" \
  -d '{"name":"Docs","url":"https://docs.example","icon":"book","color":"sapphire","folder":"Work"}'

# Update / delete
curl -X PUT http://localhost:8080/api/bookmarks/{id} -H "Content-Type: application/json" -d '{…}'
curl -X DELETE http://localhost:8080/api/bookmarks/{id}

# Export / import JSON (portable; UI no longer edits raw YAML)
curl http://localhost:8080/api/bookmarks/export -o bookmarks.json
curl -X POST 'http://localhost:8080/api/bookmarks/import?mode=merge' \
  -H "Content-Type: application/json" \
  -d @bookmarks.json
```

> [!NOTE]
> `GET/POST /api/config` still accepts raw YAML for one release (power users / migration) but is deprecated in favor of the structured bookmark APIs and Settings import/export.

# Tips and Notes

- **No authentication**: LinkSnapper has no built-in auth, so don't expose it directly to the internet. Put it behind a reverse proxy (e.g. Nginx Proxy Manager, Caddy, Traefik) with access controls, or keep it on a trusted local/VPN network.
- **Back up your data**: resources live in `data/links.json` and bookmarks in `data/bookmarks.yaml` (or whatever directory you pass to `-d`/`--data`). Back up both regularly.
- **Reverse proxy**: LinkSnapper is plain HTTP with no WebSocket usage, so a standard `proxy_pass`/reverse proxy config to the container's port (default `8080`) is all that's needed.
- **Building locally**: `make build` (or `go build .`) downloads frontend assets and compiles the `linksnapper` binary in one step; run it with `./linksnapper serve`.
