# LinkSnapper UI Rewrite Plan

**Goal:** Replace the current sidebar + YAML-config UX with the finalized mode-canvas design (`scratch/ui-variants/mode-canvas.html`), including structured bookmark editing, a Resources path-tree layout, and a Settings page for import/export.

**Source of truth for look & behavior:** `scratch/ui-variants/mode-canvas.html`  
**Out of scope for this plan:** automatic backups (placeholder only), unrelated refactors.

---

## 1. Product decisions (locked from mock)

| Decision | Choice |
|----------|--------|
| Information architecture | Three top-right pills: **Bookmarks** (default) · **Resources** · **Settings** |
| Bookmarks vs resources | Separate features; do not merge data models or promote between them |
| Bookmark editing | Inline on Bookmarks page (`+`, hover edit/delete) — **not** in Settings |
| Bookmark folders | Slash paths like resources (`Homelab/Infra`); empty folders self-clean on write |
| Bookmark chrome | Icon picker (dense Lucide set + Show more) + Catppuccin color swatches |
| Settings role | Import/export for resources **and** bookmarks; About (version + repo); Backups “coming later” |
| YAML editor | **Removed** from the UI; storage may stay YAML on disk, edited only via structured APIs |
| Resources layout | Slim path tree + dense rows (mock), not folder-card grid + large cards |
| Export button on Resources | Removed from header; lives under Settings |

---

## 2. Current state (baseline)

### 2.1 Resources (links)

- **File:** `{dataDir}/links.json`
- **Model:** `Link{ id, url, name, description, path[]string, health, lastChecked }`
- **API:** `GET/POST /api/links`, `PUT/DELETE /api/links/{id}`, `GET /api/categories` (unused by UI)
- **UI:** Main pane only; hash path browse; add/edit form; download JSON client-side; health icons
- **Import:** No server endpoint (scripts only)

### 2.2 Bookmarks

- **File:** `{dataDir}/bookmarks.yaml`
- **Backend type:** `BookmarkConfig{ Bookmarks []any }` — untyped
- **API:** `GET /api/bookmarks` (JSON array of categories); `GET/POST /api/config` (raw YAML)
- **Effective schema (UI today):**

```yaml
bookmarks:
  - category: Work
    color: ctp-sapphire   # section title color class
    folded: false
    links:
      - name: …
        url: …
        icon: folder      # Lucide name
    folders:
      - name: Infra
        icon: server
        folded: false
        links:
          - name: …
            url: …
            icon: box
```

- **UI:** Desktop-only left sidebar (read-only); gear opens YAML modal
- **Gaps:** No per-item CRUD, no filter, no mobile access, no icon/color pickers, no JSON export/import

### 2.3 Frontend assets

- Embedded: `internal/server/static/` (`index.html`, `app.js`, vendored Lucide/Tailwind, PWA)
- Mock: `scratch/ui-variants/mode-canvas.html` (CDN deps — production must keep vendored assets)

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo + title          [Bookmarks|Resources|Settings] │
└─────────────────────────────────────────────────────────┘
        │                │                 │
        ▼                ▼                 ▼
   Bookmarks view   Resources view    Settings view
   (default)        path tree+rows    import/export/about
        │                │                 │
        ▼                ▼                 ▼
  bookmarks.yaml    links.json      same files via APIs
  (typed CRUD)      (existing CRUD) (+ import merge)
```

### 3.1 Bookmark data model (keep file, type it, automate it)

**Keep** `bookmarks.yaml` as the on-disk format for backward compatibility with existing deployments. **Stop** exposing raw YAML editing in the UI.

Introduce typed Go structs that match (and lightly extend) the existing YAML:

```go
type BookmarkConfig struct {
    Bookmarks []BookmarkCategory `yaml:"bookmarks" json:"bookmarks"`
}

type BookmarkCategory struct {
    Category string           `yaml:"category" json:"category"`
    Color    string           `yaml:"color,omitempty" json:"color,omitempty"` // section accent
    Folded   bool             `yaml:"folded,omitempty" json:"folded,omitempty"`
    Links    []BookmarkLink   `yaml:"links,omitempty" json:"links,omitempty"`
    Folders  []BookmarkFolder `yaml:"folders,omitempty" json:"folders,omitempty"`
}

type BookmarkFolder struct {
    Name  string         `yaml:"name" json:"name"`
    Icon  string         `yaml:"icon,omitempty" json:"icon,omitempty"`
    Folded bool          `yaml:"folded,omitempty" json:"folded,omitempty"`
    Links []BookmarkLink `yaml:"links,omitempty" json:"links,omitempty"`
}

type BookmarkLink struct {
    ID    string `yaml:"id,omitempty" json:"id,omitempty"`       // new: stable id for CRUD
    Name  string `yaml:"name" json:"name"`
    URL   string `yaml:"url" json:"url"`
    Icon  string `yaml:"icon,omitempty" json:"icon,omitempty"`
    Color string `yaml:"color,omitempty" json:"color,omitempty"` // new: icon tint (mauve, blue, …)
}
```

**Slash folder mapping (API ↔ YAML):**

| UI folder field | YAML placement |
|-----------------|----------------|
| `Work` | Category `Work`, top-level `links` |
| `Homelab/Infra` | Category `Homelab`, folder `Infra`, `links` inside that folder |
| (empty / omitted) | Default category e.g. `Uncategorized` or first segment required |

**Depth:** Match today’s schema — **one category + one nested folder level** (`A` or `A/B`). Reject or flatten deeper paths (`A/B/C`) with a clear validation error, unless we later extend the YAML schema.

**Self-cleaning:** On every write (create/update/delete/import), prune:

1. Folders with zero links  
2. Categories with zero links and zero folders  

**IDs:** Assign UUIDs to bookmark links on first read/write if missing (migrate in place). Required for `PUT`/`DELETE` by id without rewriting the whole tree from the client.

**Color tokens:** Store bare Catppuccin names (`mauve`, `sapphire`, …) as in the mock. Map to Tailwind classes in the UI (`text-mauve` / `text-ctp-mauve`). Migrate existing `ctp-*` values by stripping the `ctp-` prefix on read if present.

**Category `color`:** Keep for section title accent. On create, if category is new, set category color from the item’s chosen color (or a default). Editing an item’s color updates the **item** icon tint; optionally leave category color unchanged unless the category was just created.

---

## 4. Backend changes

### 4.1 Bookmarks store package / rewrite `bookmarks.go`

- Parse/write typed `BookmarkConfig` with `goccy/go-yaml`
- Helpers:
  - `Load()` / `Save()` with file locking or same process-local mutex pattern as `JSONStore`
  - `EnsureIDs()` migration
  - `UpsertLink(folderPath, link)` / `UpdateLink(id, …)` / `DeleteLink(id)`
  - `PruneEmpty()`
  - `ExportJSON()` / `ImportJSON(merge|replace)`
- Preserve unknown YAML fields only if practical; prefer strict typed round-trip

### 4.2 New / updated HTTP routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/bookmarks` | Return typed tree (same shape as today + `id`/`color` on links) |
| `POST` | `/api/bookmarks` | Create bookmark. Body: `{ name, url, icon, color, folder }` where `folder` is slash path. Creates category/folder as needed. `201` + created link (with id) |
| `PUT` | `/api/bookmarks/{id}` | Update name/url/icon/color/folder (may move between categories/folders). Prune empties. |
| `DELETE` | `/api/bookmarks/{id}` | Remove link; prune empties. |
| `GET` | `/api/bookmarks/export` | Download full bookmarks document as JSON (portable; not raw YAML) |
| `POST` | `/api/bookmarks/import` | Body: export JSON. Query or field: `mode=merge\|replace`. Merge by URL or id. |
| `GET` | `/api/config` | **Deprecate** for UI; keep temporarily for power users / migration, or remove once UI is gone |
| `POST` | `/api/config` | Same — remove from UI; optional keep for one release |

Register routes in `internal/server/server.go`. Prefer a small mux helper or path trim for `{id}` consistent with links handlers.

### 4.3 Resources import (Settings)

Today only client-side **export** exists. Add:

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/links/import` | Body: `[]Link` (or `{ links: []Link }`). Mode merge/replace. Merge key = URL (existing unique constraint). Preserve ids when present and not conflicting; generate otherwise. Do not wipe health on merge of unchanged URLs if possible. |

Keep `GET /api/links` as the export source (Settings triggers download client-side, same as today’s download button).

### 4.4 Minor link API hardening (while touching handlers)

- On `PUT /api/links/{id}`, **preserve** `health` / `lastChecked` unless the URL changed (or explicitly sent). Prevents Settings-adjacent edit flows from zeroing health.
- Return JSON `Content-Type` consistently on list endpoints.
- `DELETE` of missing id → `404` (optional cleanliness).

### 4.5 Tests (new)

Add table-driven tests under `internal/server/`:

- Bookmark slash path → nested YAML placement  
- Empty folder/category prune  
- ID migration  
- CRUD move between folders  
- Import merge/replace for bookmarks and links  
- Invalid deep paths rejected  

No tests exist today; these are the highest-value additions for this feature.

### 4.6 Files to change (backend)

| File | Action |
|------|--------|
| `internal/server/bookmarks.go` | Rewrite: typed model + store + handlers |
| `internal/server/server.go` | Register new routes |
| `internal/server/handlers.go` / `storage.go` | Link import; preserve health on PUT |
| `internal/server/bookmarks_test.go` (new) | CRUD / prune / import tests |
| `internal/server/links_import_test.go` (new) | Import merge tests |
| `README.md` | Document bookmarks.yaml, new APIs, Settings import/export |

**Unchanged:** `Dockerfile` data volume, `healthcheck.go` (unless on-demand check is desired later), Linkwarden scripts (optional note that Settings import supersedes casual use).

---

## 5. Frontend changes

Replace layout/behavior of `internal/server/static/index.html` + `app.js` to match the mock. Keep **vendored** Lucide + Tailwind (no CDN in production). Port fonts/theme tokens from current `index.html` / mock.

### 5.1 Shell / navigation

- Remove left sidebar and YAML settings modal
- Sticky header: logo + “LinkSnapper”; right-side pill switcher (Bookmarks / Resources / Settings)
- Default view: Bookmarks
- Persist last view in `sessionStorage` or hash (`#bookmarks`, `#resources`, `#settings`, plus `#resources/Tech/Go` for path) — pick one scheme and stick to it

### 5.2 Bookmarks view

Port from mock:

- Title **Bookmarks** + subtitle **Quick Access Destinations**
- Filter input (borderless) + mauve `+` button
- Collapsible category sections; nested folders with subtle left guide (`bm-folder` border)
- Dense items: icon (colored) + name + host line; hover **edit** / **delete**
- Inline add/edit form:
  - Name, URL
  - Folder + Color swatches side-by-side (colors vertically aligned with folder input)
  - Icon grid: one row of icons that **fit bar width**; **Show more / Show less** with working chevron; ~130 curated Lucide names from mock `ALL_ICONS`
- Wire to `POST/PUT/DELETE /api/bookmarks…`; confirm on delete
- After mutations, re-fetch and re-render; empty categories disappear via server prune
- Open links in new tab (`target="_blank"` + `rel="noopener"`)

### 5.3 Resources view

Port from mock:

- Title **Resources** + subtitle **Saved Link Library**
- Filter/search + `+` only (no download in header)
- Existing add/edit form styling: borderless inputs; keep fields URL / Name / Category (`Tech/Go`) / Description
- Layout: left **Paths** tree (All + categories + nested), right dense rows with health icon, title, description, host, hover edit/delete
- Reuse existing client-side path logic / hash routing; optionally switch tree building to `GET /api/categories` or keep deriving from links (either is fine; categories endpoint already exists)
- Search behavior: keep multi-word fuzzy-ish filter over name/description/url/path

### 5.4 Settings view

Port from mock:

**Data**

- Export resources → download via `GET /api/links`
- Import resources → file picker → `POST /api/links/import`
- Export bookmarks → `GET /api/bookmarks/export`
- Import bookmarks → file picker → `POST /api/bookmarks/import`

**Backups**

- Placeholder card: “Automatic backups — Coming later”

**About**

- App name, version string (from build ldflags if available, else a static/`/api/health` extension), link to `https://github.com/tanq16/linksnapper`, logo

### 5.5 Shared UI polish

- Remove borders from text inputs / search / textareas; keep focus rings
- Catppuccin Mocha palette exact match to current production tokens
- Mobile: pills remain usable (icon + optional short label); bookmarks no longer desktop-only
- Re-run `lucide.createIcons()` after dynamic renders; avoid holding DOM refs to replaced SVG nodes (chevron lesson from mock)
- PWA `sw.js` / `manifest.json`: update names/icons only if needed; ensure new shell still works offline for static assets

### 5.6 Files to change (frontend)

| File | Action |
|------|--------|
| `internal/server/static/index.html` | Full shell rewrite to mode-canvas structure |
| `internal/server/static/app.js` | Split concerns: views, bookmarks CRUD, resources browse, settings I/O |
| `internal/server/static/js/lucide.min.js` | Keep; verify icon names used in `ALL_ICONS` exist in vendored build (drop/replace any missing) |
| `scratch/ui-variants/mode-canvas.html` | Keep as visual reference until ship; then optional delete |

---

## 6. Migration & compatibility

1. **Existing `bookmarks.yaml`:** On first load, parse with typed structs; assign missing `id`s; normalize `ctp-*` colors; write back once (or write-through on next edit).
2. **Existing `links.json`:** Unchanged format.
3. **API clients / scripts:** `GET /api/bookmarks` remains; shape gains `id`/`color` fields (additive). `POST /api/config` can remain one release behind a deprecation note.
4. **Docker:** No volume path changes (`/app/data`).

---

## 7. Implementation phases

### Phase 0 — Prep
- Freeze mock as UX acceptance reference
- Inventory Lucide names vs vendored `lucide.min.js`; trim `ALL_ICONS` to icons that resolve
- Decide hash vs sessionStorage view routing

### Phase 1 — Backend bookmarks
- Typed model + Load/Save + prune + ID migration
- CRUD endpoints + export/import
- Unit tests for path mapping and prune
- Manual curl against a copied `bookmarks.yaml`

### Phase 2 — Backend links import + PUT health preserve
- `POST /api/links/import`
- Fix PUT to preserve health when URL unchanged
- Tests

### Phase 3 — Frontend shell + Bookmarks view
- New header/pills; remove sidebar + YAML modal
- Bookmarks list, filter, form, icon/color pickers, CRUD wired to API
- Mobile check

### Phase 4 — Resources view reskin
- Path tree + dense rows; header parity with Bookmarks; remove header download
- Keep existing link API usage

### Phase 5 — Settings view
- Export/import UI for both datasets; About; backups placeholder
- Wire version/repo link

### Phase 6 — Docs, cleanup, verify
- README: bookmarks, Settings, API table
- Remove dead CSS/JS; optional remove `/api/config` or document as deprecated
- `make build` / `make test` / smoke on localhost
- Delete or archive `scratch/ui-variants/` when no longer needed

---

## 8. Acceptance checklist

- [ ] Default landing is Bookmarks; pills switch Bookmarks / Resources / Settings
- [ ] No YAML editor anywhere in the UI
- [ ] Can add bookmark with name, URL, folder (`A` or `A/B`), icon, color
- [ ] Edit/delete bookmarks from hover actions; empty folders/categories disappear
- [ ] Bookmark filter works; nested folder indent/guide matches mock
- [ ] Icon row fills width; Show more expands curated set; chevron flips correctly
- [ ] Resources: path tree + dense rows; add/edit/delete/search still work; health icons remain
- [ ] Settings: export/import resources and bookmarks; About links to GitHub; backups placeholder visible
- [ ] Existing `bookmarks.yaml` and `links.json` load without manual migration
- [ ] Mobile can reach bookmarks (not sidebar-gated)
- [ ] Build, tests, and local smoke pass

---

## 9. Risks & notes

| Risk | Mitigation |
|------|------------|
| Nested YAML awkward for slash paths | Centralize mapping in one Go helper; keep max depth 2 |
| Lucide CDN mock vs vendored build missing icons | Validate names against vendored file in Phase 0 |
| Import merge collisions | Document merge-by-URL; offer replace mode with confirm |
| Large `app.js` rewrite | Port view-by-view from mock; keep link API clients mostly intact |
| Users who relied on YAML | One-release soft deprecation of `/api/config`; export JSON is the new portable form |

---

## 10. Reference map

| Concern | Mock | Production today | Target |
|---------|------|------------------|--------|
| IA | mode-canvas pills | Sidebar + main | Pills |
| Bookmark edit | Inline form | YAML modal | Inline + REST |
| Bookmark store | — | `bookmarks.yaml` untyped | Same file, typed + CRUD |
| Resource layout | Path tree + rows | Cards + breadcrumbs | Path tree + rows |
| Export | Settings | Download on Resources | Settings (both datasets) |
| Import | Settings | Scripts only | Settings + API |
