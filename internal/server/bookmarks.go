package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"

	"github.com/goccy/go-yaml"
	"github.com/google/uuid"
)

type BookmarkConfig struct {
	Bookmarks []BookmarkCategory `yaml:"bookmarks" json:"bookmarks"`
}

type BookmarkCategory struct {
	Category string           `yaml:"category" json:"category"`
	Color    string           `yaml:"color,omitempty" json:"color,omitempty"`
	Folded   bool             `yaml:"folded,omitempty" json:"folded,omitempty"`
	Links    []BookmarkLink   `yaml:"links,omitempty" json:"links,omitempty"`
	Folders  []BookmarkFolder `yaml:"folders,omitempty" json:"folders,omitempty"`
}

type BookmarkFolder struct {
	Name   string         `yaml:"name" json:"name"`
	Icon   string         `yaml:"icon,omitempty" json:"icon,omitempty"`
	Folded bool           `yaml:"folded,omitempty" json:"folded,omitempty"`
	Links  []BookmarkLink `yaml:"links,omitempty" json:"links,omitempty"`
}

type BookmarkLink struct {
	ID    string `yaml:"id,omitempty" json:"id,omitempty"`
	Name  string `yaml:"name" json:"name"`
	URL   string `yaml:"url" json:"url"`
	Icon  string `yaml:"icon,omitempty" json:"icon,omitempty"`
	Color string `yaml:"color,omitempty" json:"color,omitempty"`
}

type BookmarkInput struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	Icon   string `json:"icon"`
	Color  string `json:"color"`
	Folder string `json:"folder"`
}

var ErrBookmarkNotFound = errors.New("bookmark not found")

type BookmarkStore struct {
	file string
	mu   sync.Mutex
}

func NewBookmarkStore(dataDir string) *BookmarkStore {
	return &BookmarkStore{file: filepath.Join(dataDir, "bookmarks.yaml")}
}

func (s *BookmarkStore) Load() (BookmarkConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	config, err := s.load()
	if err != nil {
		return BookmarkConfig{}, err
	}
	if ensureBookmarkIDs(&config) {
		if err := s.save(config); err != nil {
			return BookmarkConfig{}, err
		}
	}
	return config, nil
}

func (s *BookmarkStore) Save(config BookmarkConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ensureBookmarkIDs(&config)
	pruneBookmarks(&config)
	return s.save(config)
}

func (s *BookmarkStore) Create(folderPath string, link BookmarkLink) (BookmarkLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	path, err := parseBookmarkPath(folderPath)
	if err != nil {
		return BookmarkLink{}, err
	}
	config, err := s.load()
	if err != nil {
		return BookmarkLink{}, err
	}
	ensureBookmarkIDs(&config)
	if link.ID == "" {
		link.ID = uuid.NewString()
	}
	link.Color = normalizeBookmarkColor(link.Color)
	addBookmark(&config, path, link, BookmarkCategory{})
	pruneBookmarks(&config)
	if err := s.save(config); err != nil {
		return BookmarkLink{}, err
	}
	return link, nil
}

func (s *BookmarkStore) Upsert(folderPath string, link BookmarkLink) (BookmarkLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	path, err := parseBookmarkPath(folderPath)
	if err != nil {
		return BookmarkLink{}, err
	}
	config, err := s.load()
	if err != nil {
		return BookmarkLink{}, err
	}
	ensureBookmarkIDs(&config)
	if link.ID == "" {
		link.ID = uuid.NewString()
	}
	link.Color = normalizeBookmarkColor(link.Color)
	removeBookmarkMatch(&config, link.ID, link.URL)
	addBookmark(&config, path, link, BookmarkCategory{})
	pruneBookmarks(&config)
	if err := s.save(config); err != nil {
		return BookmarkLink{}, err
	}
	return link, nil
}

func (s *BookmarkStore) Update(id, folderPath string, link BookmarkLink) (BookmarkLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	path, err := parseBookmarkPath(folderPath)
	if err != nil {
		return BookmarkLink{}, err
	}
	config, err := s.load()
	if err != nil {
		return BookmarkLink{}, err
	}
	ensureBookmarkIDs(&config)
	if !removeBookmarkID(&config, id) {
		return BookmarkLink{}, ErrBookmarkNotFound
	}
	link.ID = id
	link.Color = normalizeBookmarkColor(link.Color)
	addBookmark(&config, path, link, BookmarkCategory{})
	pruneBookmarks(&config)
	if err := s.save(config); err != nil {
		return BookmarkLink{}, err
	}
	return link, nil
}

func (s *BookmarkStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	config, err := s.load()
	if err != nil {
		return err
	}
	ensureBookmarkIDs(&config)
	if !removeBookmarkID(&config, id) {
		return ErrBookmarkNotFound
	}
	pruneBookmarks(&config)
	return s.save(config)
}

func (s *BookmarkStore) ExportJSON() ([]byte, error) {
	config, err := s.Load()
	if err != nil {
		return nil, err
	}
	return json.MarshalIndent(config, "", "  ")
}

func (s *BookmarkStore) ImportJSON(data []byte, mode string) error {
	if mode != "merge" && mode != "replace" {
		return fmt.Errorf("invalid import mode %q", mode)
	}

	var document struct {
		Bookmarks *[]BookmarkCategory `json:"bookmarks"`
	}
	if err := json.Unmarshal(data, &document); err != nil {
		return err
	}
	if document.Bookmarks == nil {
		return fmt.Errorf("bookmarks field is required")
	}
	imported := BookmarkConfig{Bookmarks: *document.Bookmarks}
	ensureBookmarkIDs(&imported)
	pruneBookmarks(&imported)

	s.mu.Lock()
	defer s.mu.Unlock()

	if mode == "replace" {
		return s.save(imported)
	}
	config, err := s.load()
	if err != nil {
		return err
	}
	ensureBookmarkIDs(&config)
	mergeBookmarks(&config, imported)
	pruneBookmarks(&config)
	return s.save(config)
}

func (s *BookmarkStore) ReadRaw() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.file)
	if os.IsNotExist(err) {
		return []byte("bookmarks:\n"), nil
	}
	return data, err
}

func (s *BookmarkStore) WriteRaw(data []byte) error {
	var config BookmarkConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	return s.save(config)
}

func (s *BookmarkStore) load() (BookmarkConfig, error) {
	data, err := os.ReadFile(s.file)
	if os.IsNotExist(err) {
		return BookmarkConfig{Bookmarks: []BookmarkCategory{}}, nil
	}
	if err != nil {
		return BookmarkConfig{}, err
	}
	var config BookmarkConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return BookmarkConfig{}, err
	}
	if config.Bookmarks == nil {
		config.Bookmarks = []BookmarkCategory{}
	}
	return config, nil
}

func (s *BookmarkStore) save(config BookmarkConfig) error {
	ensureBookmarkIDs(&config)
	pruneBookmarks(&config)
	if config.Bookmarks == nil {
		config.Bookmarks = []BookmarkCategory{}
	}
	data, err := yaml.Marshal(config)
	if err != nil {
		return err
	}
	return os.WriteFile(s.file, data, 0644)
}

func ensureBookmarkIDs(config *BookmarkConfig) bool {
	changed := false
	seen := make(map[string]bool)
	for categoryIndex := range config.Bookmarks {
		category := &config.Bookmarks[categoryIndex]
		color := normalizeBookmarkColor(category.Color)
		if color != category.Color {
			category.Color = color
			changed = true
		}
		for linkIndex := range category.Links {
			if normalizeBookmarkLink(&category.Links[linkIndex], seen) {
				changed = true
			}
		}
		for folderIndex := range category.Folders {
			for linkIndex := range category.Folders[folderIndex].Links {
				if normalizeBookmarkLink(&category.Folders[folderIndex].Links[linkIndex], seen) {
					changed = true
				}
			}
		}
	}
	return changed
}

func normalizeBookmarkLink(link *BookmarkLink, seen map[string]bool) bool {
	changed := false
	if link.ID == "" || seen[link.ID] {
		link.ID = uuid.NewString()
		changed = true
	}
	seen[link.ID] = true
	color := normalizeBookmarkColor(link.Color)
	if color != link.Color {
		link.Color = color
		changed = true
	}
	return changed
}

func normalizeBookmarkColor(color string) string {
	return strings.TrimPrefix(color, "ctp-")
}

func parseBookmarkPath(folderPath string) ([]string, error) {
	folderPath = strings.TrimSpace(folderPath)
	if folderPath == "" {
		return []string{"Uncategorized"}, nil
	}
	parts := strings.Split(folderPath, "/")
	if len(parts) > 2 {
		return nil, fmt.Errorf("bookmark folder path supports at most category/folder")
	}
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
		if parts[i] == "" {
			return nil, fmt.Errorf("bookmark folder path contains an empty segment")
		}
	}
	return parts, nil
}

func addBookmark(config *BookmarkConfig, path []string, link BookmarkLink, source BookmarkCategory) {
	categoryIndex := slices.IndexFunc(config.Bookmarks, func(category BookmarkCategory) bool {
		return category.Category == path[0]
	})
	if categoryIndex == -1 {
		color := source.Color
		if color == "" {
			color = link.Color
		}
		config.Bookmarks = append(config.Bookmarks, BookmarkCategory{
			Category: path[0],
			Color:    normalizeBookmarkColor(color),
			Folded:   source.Folded,
		})
		categoryIndex = len(config.Bookmarks) - 1
	}
	category := &config.Bookmarks[categoryIndex]
	if len(path) == 1 {
		category.Links = append(category.Links, link)
		return
	}
	folderIndex := slices.IndexFunc(category.Folders, func(folder BookmarkFolder) bool {
		return folder.Name == path[1]
	})
	if folderIndex == -1 {
		var folder BookmarkFolder
		for _, candidate := range source.Folders {
			if candidate.Name == path[1] {
				folder = candidate
				folder.Links = nil
				break
			}
		}
		folder.Name = path[1]
		category.Folders = append(category.Folders, folder)
		folderIndex = len(category.Folders) - 1
	}
	category.Folders[folderIndex].Links = append(category.Folders[folderIndex].Links, link)
}

func removeBookmarkID(config *BookmarkConfig, id string) bool {
	removed := false
	for categoryIndex := range config.Bookmarks {
		category := &config.Bookmarks[categoryIndex]
		before := len(category.Links)
		category.Links = slices.DeleteFunc(category.Links, func(link BookmarkLink) bool {
			return link.ID == id
		})
		removed = removed || len(category.Links) != before
		for folderIndex := range category.Folders {
			folder := &category.Folders[folderIndex]
			before = len(folder.Links)
			folder.Links = slices.DeleteFunc(folder.Links, func(link BookmarkLink) bool {
				return link.ID == id
			})
			removed = removed || len(folder.Links) != before
		}
	}
	return removed
}

func removeBookmarkMatch(config *BookmarkConfig, id, bookmarkURL string) string {
	existingID := ""
	for categoryIndex := range config.Bookmarks {
		category := &config.Bookmarks[categoryIndex]
		category.Links = slices.DeleteFunc(category.Links, func(link BookmarkLink) bool {
			match := (id != "" && link.ID == id) || (bookmarkURL != "" && link.URL == bookmarkURL)
			if match && existingID == "" {
				existingID = link.ID
			}
			return match
		})
		for folderIndex := range category.Folders {
			folder := &category.Folders[folderIndex]
			folder.Links = slices.DeleteFunc(folder.Links, func(link BookmarkLink) bool {
				match := (id != "" && link.ID == id) || (bookmarkURL != "" && link.URL == bookmarkURL)
				if match && existingID == "" {
					existingID = link.ID
				}
				return match
			})
		}
	}
	return existingID
}

func pruneBookmarks(config *BookmarkConfig) {
	for categoryIndex := range config.Bookmarks {
		category := &config.Bookmarks[categoryIndex]
		category.Folders = slices.DeleteFunc(category.Folders, func(folder BookmarkFolder) bool {
			return len(folder.Links) == 0
		})
	}
	config.Bookmarks = slices.DeleteFunc(config.Bookmarks, func(category BookmarkCategory) bool {
		return len(category.Links) == 0 && len(category.Folders) == 0
	})
}

func mergeBookmarks(config *BookmarkConfig, imported BookmarkConfig) {
	for _, category := range imported.Bookmarks {
		for _, link := range category.Links {
			if existingID := removeBookmarkMatch(config, link.ID, link.URL); existingID != "" {
				link.ID = existingID
			}
			addBookmark(config, []string{category.Category}, link, category)
		}
		for _, folder := range category.Folders {
			for _, link := range folder.Links {
				if existingID := removeBookmarkMatch(config, link.ID, link.URL); existingID != "" {
					link.ID = existingID
				}
				addBookmark(config, []string{category.Category, folder.Name}, link, category)
			}
		}
	}
}

func (s *Server) handleBookmarks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		config, err := s.bookmarks.Load()
		if err != nil {
			log.Printf("ERROR Failed to load bookmarks: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, config.Bookmarks)
	case http.MethodPost:
		input, ok := decodeBookmarkInput(w, r)
		if !ok {
			return
		}
		link, err := s.bookmarks.Create(input.Folder, input.BookmarkLink())
		if err != nil {
			log.Printf("ERROR Failed to create bookmark: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, link)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleBookmarksPath(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/bookmarks/")
	switch path {
	case "export":
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		data, err := s.bookmarks.ExportJSON()
		if err != nil {
			log.Printf("ERROR Failed to export bookmarks: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	case "import":
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		data, mode, err := decodeBookmarkImport(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.bookmarks.ImportJSON(data, mode); err != nil {
			log.Printf("ERROR Failed to import bookmarks: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		if path == "" || strings.Contains(path, "/") {
			http.NotFound(w, r)
			return
		}
		s.handleBookmarkByID(w, r, path)
	}
}

func (s *Server) handleBookmarkByID(w http.ResponseWriter, r *http.Request, id string) {
	switch r.Method {
	case http.MethodPut:
		input, ok := decodeBookmarkInput(w, r)
		if !ok {
			return
		}
		link, err := s.bookmarks.Update(id, input.Folder, input.BookmarkLink())
		if errors.Is(err, ErrBookmarkNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("ERROR Failed to update bookmark %s: %v", id, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, link)
	case http.MethodDelete:
		err := s.bookmarks.Delete(id)
		if errors.Is(err, ErrBookmarkNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		if err != nil {
			log.Printf("ERROR Failed to delete bookmark %s: %v", id, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func decodeBookmarkInput(w http.ResponseWriter, r *http.Request) (BookmarkInput, bool) {
	var input BookmarkInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return BookmarkInput{}, false
	}
	input.Name = strings.TrimSpace(input.Name)
	input.URL = strings.TrimSpace(input.URL)
	if input.Name == "" || input.URL == "" {
		http.Error(w, "name and url are required", http.StatusBadRequest)
		return BookmarkInput{}, false
	}
	if _, err := parseBookmarkPath(input.Folder); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return BookmarkInput{}, false
	}
	return input, true
}

func (i BookmarkInput) BookmarkLink() BookmarkLink {
	return BookmarkLink{
		Name:  i.Name,
		URL:   i.URL,
		Icon:  i.Icon,
		Color: i.Color,
	}
}

func decodeBookmarkImport(r *http.Request) ([]byte, string, error) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, "", err
	}
	var envelope struct {
		Bookmarks *[]BookmarkCategory `json:"bookmarks"`
		Mode      string              `json:"mode"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, "", err
	}
	if envelope.Bookmarks == nil {
		return nil, "", fmt.Errorf("bookmarks field is required")
	}
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = envelope.Mode
	}
	if mode == "" {
		mode = "merge"
	}
	if mode != "merge" && mode != "replace" {
		return nil, "", fmt.Errorf("invalid import mode %q", mode)
	}
	return data, mode, nil
}

func (s *Server) handleConfigRaw(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		data, err := s.bookmarks.ReadRaw()
		if err != nil {
			log.Printf("ERROR Failed to read bookmarks config: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write(data)

	case http.MethodPost:
		data, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("ERROR Failed to read request body: %v", err)
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		if err := s.bookmarks.WriteRaw(data); err != nil {
			log.Printf("ERROR Invalid YAML provided: %v", err)
			http.Error(w, "Invalid YAML format", http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
