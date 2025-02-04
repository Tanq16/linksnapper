package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
)

type Store struct {
	links []Link
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
		links: make([]Link, 0),
	}
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

func (s *Store) AddLink(link Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if link.ID == "" {
		link.ID = uuid.New().String()
	}
	s.links = append(s.links, link)
	return s.saveToFile()
}

func (s *Store) DeleteLink(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, link := range s.links {
		if link.ID == id {
			s.links[i] = s.links[len(s.links)-1]
			s.links = s.links[:len(s.links)-1]
			return s.saveToFile()
		}
	}
	return nil
}

func (s *Store) UpdateLink(id string, updatedLink Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, link := range s.links {
		if link.ID == id {
			updatedLink.ID = id
			s.links[i] = updatedLink
			return s.saveToFile()
		}
	}
	return fmt.Errorf("link not found")
}

func (s *Store) GetLinks() []Link {
	s.mu.RLock()
	defer s.mu.RUnlock()
	links := make([]Link, len(s.links))
	copy(links, s.links)
	return links
}

func (s *Store) GetCategories() *Category {
	s.mu.RLock()
	defer s.mu.RUnlock()
	root := NewCategory("root", []string{})
	for _, link := range s.links {
		current := root
		currentPath := []string{}
		for _, segment := range link.Path {
			currentPath = append(currentPath, segment)
			if _, exists := current.Categories[segment]; !exists {
				current.Categories[segment] = NewCategory(segment, currentPath)
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
