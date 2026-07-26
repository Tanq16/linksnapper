package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBookmarkPathPlacement(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		wantFolder string
		wantErr    bool
	}{
		{name: "category", path: "Work"},
		{name: "nested folder", path: "Homelab/Infra", wantFolder: "Infra"},
		{name: "empty defaults", path: ""},
		{name: "deep path rejected", path: "A/B/C", wantErr: true},
		{name: "empty segment rejected", path: "A//B", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewBookmarkStore(t.TempDir())
			created, err := store.Create(tt.path, BookmarkLink{Name: "Link", URL: "https://example.com"})
			if (err != nil) != tt.wantErr {
				t.Fatalf("Create() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			config, err := store.Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}
			if len(config.Bookmarks) != 1 {
				t.Fatalf("Load() categories = %d, want 1", len(config.Bookmarks))
			}
			category := config.Bookmarks[0]
			if tt.path == "" && category.Category != "Uncategorized" {
				t.Fatalf("category = %q, want Uncategorized", category.Category)
			}
			if tt.wantFolder == "" {
				if len(category.Links) != 1 || category.Links[0].ID != created.ID {
					t.Fatalf("category links = %#v, want created link", category.Links)
				}
				return
			}
			if len(category.Folders) != 1 || category.Folders[0].Name != tt.wantFolder {
				t.Fatalf("folders = %#v, want %q", category.Folders, tt.wantFolder)
			}
			if len(category.Folders[0].Links) != 1 || category.Folders[0].Links[0].ID != created.ID {
				t.Fatalf("folder links = %#v, want created link", category.Folders[0].Links)
			}
		})
	}
}

func TestBookmarkPruneAndMove(t *testing.T) {
	store := NewBookmarkStore(t.TempDir())
	created, err := store.Create("Old/Folder", BookmarkLink{Name: "Link", URL: "https://example.com"})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	updated, err := store.Update(created.ID, "New/Folder", BookmarkLink{Name: "Moved", URL: created.URL})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if updated.ID != created.ID {
		t.Fatalf("Update() ID = %q, want %q", updated.ID, created.ID)
	}
	config, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(config.Bookmarks) != 1 || config.Bookmarks[0].Category != "New" {
		t.Fatalf("categories after move = %#v, want only New", config.Bookmarks)
	}
	if err := store.Delete(created.ID); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	config, err = store.Load()
	if err != nil {
		t.Fatalf("Load() after delete error = %v", err)
	}
	if len(config.Bookmarks) != 0 {
		t.Fatalf("categories after delete = %#v, want empty", config.Bookmarks)
	}
}

func TestBookmarkSavePrunesEmpty(t *testing.T) {
	store := NewBookmarkStore(t.TempDir())
	config := BookmarkConfig{Bookmarks: []BookmarkCategory{
		{Category: "Empty"},
		{
			Category: "Mixed",
			Folders: []BookmarkFolder{
				{Name: "Empty"},
				{Name: "Kept", Links: []BookmarkLink{{Name: "Link", URL: "https://example.com"}}},
			},
		},
	}}
	if err := store.Save(config); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	got, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if len(got.Bookmarks) != 1 || got.Bookmarks[0].Category != "Mixed" {
		t.Fatalf("pruned categories = %#v, want only Mixed", got.Bookmarks)
	}
	if len(got.Bookmarks[0].Folders) != 1 || got.Bookmarks[0].Folders[0].Name != "Kept" {
		t.Fatalf("pruned folders = %#v, want only Kept", got.Bookmarks[0].Folders)
	}
}

func TestBookmarkIDAndColorMigration(t *testing.T) {
	dataDir := t.TempDir()
	file := filepath.Join(dataDir, "bookmarks.yaml")
	input := []byte("bookmarks:\n  - category: Work\n    color: ctp-sapphire\n    links:\n      - name: Docs\n        url: https://example.com\n        color: ctp-mauve\n")
	if err := os.WriteFile(file, input, 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	store := NewBookmarkStore(dataDir)
	config, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	link := config.Bookmarks[0].Links[0]
	if link.ID == "" {
		t.Fatal("Load() did not assign an ID")
	}
	if config.Bookmarks[0].Color != "sapphire" || link.Color != "mauve" {
		t.Fatalf("normalized colors = %q/%q, want sapphire/mauve", config.Bookmarks[0].Color, link.Color)
	}
	reloaded, err := NewBookmarkStore(dataDir).Load()
	if err != nil {
		t.Fatalf("reloaded Load() error = %v", err)
	}
	if reloaded.Bookmarks[0].Links[0].ID != link.ID {
		t.Fatalf("persisted ID = %q, want %q", reloaded.Bookmarks[0].Links[0].ID, link.ID)
	}
}

func TestBookmarkImportModes(t *testing.T) {
	tests := []struct {
		name      string
		mode      string
		wantCount int
		wantOld   bool
	}{
		{name: "merge", mode: "merge", wantCount: 2, wantOld: true},
		{name: "replace", mode: "replace", wantCount: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := NewBookmarkStore(t.TempDir())
			existing, err := store.Create("Existing", BookmarkLink{Name: "Old", URL: "https://same.example"})
			if err != nil {
				t.Fatalf("Create() error = %v", err)
			}
			imported := BookmarkConfig{Bookmarks: []BookmarkCategory{{
				Category: "Imported",
				Links: []BookmarkLink{{
					ID:   "different-id",
					Name: "Updated",
					URL:  "https://same.example",
				}},
			}}}
			if tt.wantOld {
				imported.Bookmarks[0].Links = append(imported.Bookmarks[0].Links, BookmarkLink{
					Name: "Additional",
					URL:  "https://new.example",
				})
			}
			data, err := json.Marshal(imported)
			if err != nil {
				t.Fatalf("Marshal() error = %v", err)
			}
			if err := store.ImportJSON(data, tt.mode); err != nil {
				t.Fatalf("ImportJSON() error = %v", err)
			}
			config, err := store.Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}
			links := bookmarkLinks(config)
			if len(links) != tt.wantCount {
				t.Fatalf("imported links = %d, want %d", len(links), tt.wantCount)
			}
			if tt.mode == "merge" && links[0].ID != existing.ID {
				t.Fatalf("merged matching URL ID = %q, want %q", links[0].ID, existing.ID)
			}
		})
	}
}

func TestLinkImportModesAndHealth(t *testing.T) {
	checked := time.Date(2026, time.July, 26, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name      string
		mode      string
		wantCount int
	}{
		{name: "merge", mode: "merge", wantCount: 2},
		{name: "replace", mode: "replace", wantCount: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			storeValue, err := NewStore(t.TempDir())
			if err != nil {
				t.Fatalf("NewStore() error = %v", err)
			}
			store := storeValue.(*JSONStore)
			existing := Link{
				ID:          "existing-id",
				URL:         "https://same.example",
				Name:        "Old",
				Health:      Health{Status: "healthy", StatusCode: 200},
				LastChecked: checked,
			}
			if _, err := store.AddLink(existing); err != nil {
				t.Fatalf("AddLink() error = %v", err)
			}
			imported := []Link{{ID: "incoming-id", URL: existing.URL, Name: "Updated"}}
			if tt.mode == "merge" {
				imported = append(imported, Link{URL: "https://new.example", Name: "New"})
			}
			if err := store.ImportLinks(imported, tt.mode); err != nil {
				t.Fatalf("ImportLinks() error = %v", err)
			}
			links := store.GetLinks()
			if len(links) != tt.wantCount {
				t.Fatalf("GetLinks() count = %d, want %d", len(links), tt.wantCount)
			}
			same := links[0]
			if tt.mode == "merge" && (same.ID != existing.ID || same.Health != existing.Health || !same.LastChecked.Equal(checked)) {
				t.Fatalf("merged link = %#v, want preserved ID and health", same)
			}
			for _, link := range links {
				if link.ID == "" {
					t.Fatalf("imported link has empty ID: %#v", link)
				}
			}
		})
	}
}

func TestUpdateLinkHealthPreservation(t *testing.T) {
	storeValue, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("NewStore() error = %v", err)
	}
	store := storeValue.(*JSONStore)
	checked := time.Now()
	existing := Link{
		ID:          "id",
		URL:         "https://same.example",
		Health:      Health{Status: "healthy"},
		LastChecked: checked,
	}
	if _, err := store.AddLink(existing); err != nil {
		t.Fatalf("AddLink() error = %v", err)
	}
	if err := store.UpdateLink(existing.ID, Link{URL: existing.URL, Name: "Renamed"}); err != nil {
		t.Fatalf("UpdateLink() error = %v", err)
	}
	got := store.GetLinks()[0]
	if got.Health != existing.Health || !got.LastChecked.Equal(checked) {
		t.Fatalf("UpdateLink() health = %#v/%v, want preserved", got.Health, got.LastChecked)
	}
}

func bookmarkLinks(config BookmarkConfig) []BookmarkLink {
	var links []BookmarkLink
	for _, category := range config.Bookmarks {
		links = append(links, category.Links...)
		for _, folder := range category.Folders {
			links = append(links, folder.Links...)
		}
	}
	return links
}
