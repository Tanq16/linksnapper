package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
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

	// Load existing links if file exists
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

	// Generate UUID if not provided
	if link.ID == "" {
		link.ID = uuid.New().String()
	}

	// Add link to memory
	s.links = append(s.links, link)

	// Save to file
	return s.saveToFile()
}

func (s *Store) DeleteLink(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find and remove the link
	for i, link := range s.links {
		if link.ID == id {
			// Remove link by replacing it with the last element and truncating
			s.links[i] = s.links[len(s.links)-1]
			s.links = s.links[:len(s.links)-1]
			return s.saveToFile()
		}
	}

	return nil
}

func (s *Store) GetLinks() []models.Link {
	s.mu.RLock()
	defer s.mu.RUnlock()

	links := make([]models.Link, len(s.links))
	copy(links, s.links)
	return links
}

func (s *Store) GetCategories() *models.Category {
	s.mu.RLock()
	defer s.mu.RUnlock()

	root := models.NewCategory("root", []string{})

	// Build category tree from link paths
	for _, link := range s.links {
		current := root
		currentPath := []string{}

		for _, segment := range link.Path {
			currentPath = append(currentPath, segment)

			if _, exists := current.Categories[segment]; !exists {
				current.Categories[segment] = models.NewCategory(segment, currentPath)
			}
			current = current.Categories[segment]
		}
	}

	return root
}

func (s *Store) saveToFile() error {
	data, err := json.MarshalIndent(s.links, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.file, data, 0644)
}
