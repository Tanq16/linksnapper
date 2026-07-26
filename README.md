<p align="center">
<img src="/assets/logo.png" alt="LinkSnapper Logo" width=250px /><br>
<h1 align="center">LinkSnapper</h1><br>

<p align="center">
<a href="https://github.com/tanq16/linksnapper/actions/workflows/release.yml"><img src="https://github.com/tanq16/linksnapper/actions/workflows/release.yml/badge.svg" alt="Release Build"></a>&nbsp;<a href="https://github.com/Tanq16/linksnapper/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/tanq16/linksnapper"></a>&nbsp;<a href="https://hub.docker.com/r/tanq16/linksnapper"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/tanq16/linksnapper"></a>
</p>
</p>

`LinkSnapper` is a sleek and minimalist bookmark manager designed for homelab use. It supports a hierarchical category system with a simple and intuitive web interface. It's available for all operating systems and architectures as a binary as well as a multi-architecture container image.

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

- Simple bookmark management with essential details (URL, name, description, and categories)
- Multi-level path-based category support, with fuzzy match for new links
- Fuzzy word search across all links, descriptions, and descriptions to find what's needed
- REST API for bookmark management
- Intuitive navigation via breadcrumbs, folders, and links
- Clean and responsive web interface with Catppuccin Mocha theme powered by Tailwind.CSS
- Flat file storage system (`data/links.json`)

### Organization

1. Hierarchical Category System
    - Create unlimited nested categories in a tree-like structure
    - Easy navigation with breadcrumb trails
2. Smart (fuzzy) Category Suggestions
    - Auto-suggests existing categories while adding new links
    - Prevents category fragmentation
3. Quick Access Interface
    - Fast link addition with minimal clicks
    - Efficient search through browser's built-in search

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

Add Link:

```bash
curl -X POST http://localhost:8080/api/links \
-H "Content-Type: application/json" \
-d '{
    "url": "https://example.com",
    "name": "Example Site",
    "description": "An example website",
    "path": ["Tech", "Resources"]
}'
```

Get All Links:

```bash
curl http://localhost:8080/api/links
```

Delete Link:

```bash
curl -X DELETE http://localhost:8080/api/links/{id}
```

Update Link:

```bash
curl -X PUT http://localhost:8080/api/links/{id} \
-H "Content-Type: application/json" \
-d '{
    "url": "https://example.com",
    "name": "Updated Name",
    "description": "Updated description",
    "path": ["New", "Category", "Path"]
}'
```

# Tips and Notes

- **No authentication**: LinkSnapper has no built-in auth, so don't expose it directly to the internet. Put it behind a reverse proxy (e.g. Nginx Proxy Manager, Caddy, Traefik) with access controls, or keep it on a trusted local/VPN network.
- **Back up your data**: all bookmarks live in a single flat file at `data/links.json` (or whatever directory you pass to `-d`/`--data`). Back up this file/volume regularly since it's the only source of truth.
- **Reverse proxy**: LinkSnapper is plain HTTP with no WebSocket usage, so a standard `proxy_pass`/reverse proxy config to the container's port (default `8080`) is all that's needed.
- **Building locally**: `make build` (or `go build .`) downloads frontend assets and compiles the `linksnapper` binary in one step; run it with `./linksnapper serve`.
