<p align="center">
<img src="/assets/logo.png" alt="LinkSnapper Logo" width=250px /><br>
<h1 align="center">LinkSnapper</h1><br>

<p align="center">
<a href="https://github.com/tanq16/linksnapper/actions/workflows/release.yml"><img src="https://github.com/tanq16/linksnapper/actions/workflows/release.yml/badge.svg" alt="Release Build"></a>&nbsp;<a href="https://goreportcard.com/report/github.com/tanq16/linksnapper"><img src="https://goreportcard.com/badge/github.com/tanq16/linksnapper" alt="Go Report Card"></a><br>
<a href="https://github.com/Tanq16/linksnapper/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/tanq16/linksnapper"></a>&nbsp;<a href="https://hub.docker.com/r/tanq16/linksnapper"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/tanq16/linksnapper"></a>
</p>
</p>

`LinkSnapper` is a sleek and minimalist bookmark manager designed for homelab use. It supports a hierarchical category system with a simple and intuitive web interface. It's available for all operating systems and architectures as a binary as well as a multi-architecture container image.

---

- [Why Create This](#why-create-this)
- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Tech Stack](#technology-stack)

# Why Create This?

There are numerous bookmark managers available, and they're great. My personal favorites are Hoarder and Linkwarden. But I wanted an even simpler solution that I could integrate my AI-Context project with, mainly to get text-based backups of my links and repositories. I also wanted a significantly simpler format of links to create a shareable repository from my bookmarks. LinkSnapper was created to be that lightweight, no-nonsense bookmark manager that just works. (*Integration of AI-Context is a WIP*)

# Features

### Core Functionality

- Simple bookmark management with essential details (URL, name, description, and categories)
- Multi-level path-based category support, with fuzzy match for new links
- UUID-based link identification in the backend
- REST API for bookmark management
- Intuitive search and navigation for links
- Clean and responsive web interface with light and dark mode support
- Flat file storage system (`data/links.json`)

### Organization

1. Hierarchical Category System
    - Create unlimited nested categories
    - Organize links in a tree-like structure
    - Easy navigation with breadcrumb trails
2. Smart (fuzzy) Category Suggestions
    - Auto-suggests existing categories while adding new links
    - Prevents category fragmentation
3. Quick Access Interface
    - Fast link addition with minimal clicks
    - Efficient search through browser's built-in search

# Screenshots

| | Desktop View | Mobile View |
| --- | --- | --- |
| Light | <img src="/assets/dlight.png" alt="Light" /> | <img src="/assets/mlight.png" alt="Mobile Light" /> |
| Dark | <img src="/assets/ddark.png" alt="Dark" /> | <img src="/assets/mdark.png" alt="Mobile Dark" /> |

> [!TIP]
> The interface automatically adapts to system preferences for themes. The views are optimized for both desktop and mobile use.

# Installation

### Go Install

```bash
go install github.com/tanq16/linksnapper/cmd@latest
```

### Docker Installation

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

### Building from Source

```bash
git clone https://github.com/tanq16/linksnapper.git && \
cd linksnapper && \
go build ./cmd/linksnapper
```

# Usage

Access the web interface through your browser at `http://localhost:8080/`

> [!NOTE]
> This app has no authentication, so deploy carefully. It works well with a reverse proxy like Nginx Proxy Manager and is mainly intended for homelab use.

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

# Technology Stack

- Build using Go for the backend
- Flat JSON file for storage
- Vanilla JavaScript, HTML, and CSS for the frontend
- REST API and Web UI for interaction
