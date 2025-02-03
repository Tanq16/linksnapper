package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/tanq16/linksnapper/internal/models"
)

type Store struct {
	links []models.Link
	mu    sync.RWMutex
	file  string
}

func NewStore(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	file := filepath.Join(dataDir, "links.json")
	store := &Store{
		file:  file,
		links: make([]models.Link, 0),
	}

	// Load existing data if file exists
	if _, err := os.Stat(file); err == nil {
		data, err := os.ReadFile(file)
		if err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, &store.links); err != nil {
			return nil, err
		}
	}

	return store, nil
}

func (s *Store) AddLink(link models.Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Add link to memory
	s.links = append(s.links, link)

	// Save to file
	return s.saveToFile()
}

func (s *Store) GetLinks() []models.Link {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy to prevent modification of internal state
	links := make([]models.Link, len(s.links))
	copy(links, s.links)
	return links
}

func (s *Store) saveToFile() error {
	data, err := json.MarshalIndent(s.links, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.file, data, 0644)
}
