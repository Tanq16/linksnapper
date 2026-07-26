package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"sync"

	"github.com/google/uuid"
)

type Store interface {
	GetLinks() []Link
	AddLink(link Link) (Link, error)
	DeleteLink(id string) error
	UpdateLink(id string, updated Link) error
	ImportLinks(links []Link, mode string) error
	GetCategories() *Category
}

var ErrLinkNotFound = errors.New("link not found")

type JSONStore struct {
	links []Link
	mu    sync.RWMutex
	file  string
}

func NewStore(dataDir string) (Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}
	file := filepath.Join(dataDir, "links.json")
	store := &JSONStore{
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

func (s *JSONStore) AddLink(link Link) (Link, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existingLink := range s.links {
		if existingLink.URL == link.URL {
			return Link{}, fmt.Errorf("link already exists")
		}
	}
	if link.ID == "" {
		link.ID = uuid.NewString()
	}
	s.links = append(s.links, link)
	if err := s.saveToFile(); err != nil {
		return Link{}, err
	}
	return link, nil
}

func (s *JSONStore) DeleteLink(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, link := range s.links {
		if link.ID == id {
			s.links = slices.Delete(s.links, i, i+1)
			return s.saveToFile()
		}
	}
	return ErrLinkNotFound
}

func (s *JSONStore) UpdateLink(id string, updatedLink Link) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, link := range s.links {
		if link.ID == id {
			updatedLink.ID = id
			if updatedLink.URL == link.URL {
				updatedLink.Health = link.Health
				updatedLink.LastChecked = link.LastChecked
			}
			s.links[i] = updatedLink
			return s.saveToFile()
		}
	}
	return ErrLinkNotFound
}

func (s *JSONStore) ImportLinks(imported []Link, mode string) error {
	if mode != "merge" && mode != "replace" {
		return fmt.Errorf("invalid import mode %q", mode)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	links := make([]Link, 0, len(s.links)+len(imported))
	if mode == "merge" {
		links = append(links, s.links...)
	}
	usedIDs := make(map[string]bool, len(links)+len(imported))
	for i := range links {
		if links[i].ID == "" || usedIDs[links[i].ID] {
			links[i].ID = uuid.NewString()
		}
		usedIDs[links[i].ID] = true
	}
	for _, incoming := range imported {
		existingIndex := slices.IndexFunc(links, func(link Link) bool {
			return link.URL == incoming.URL
		})
		if existingIndex >= 0 {
			existing := links[existingIndex]
			incoming.ID = existing.ID
			incoming.Health = existing.Health
			incoming.LastChecked = existing.LastChecked
			links[existingIndex] = incoming
			continue
		}
		if incoming.ID == "" || usedIDs[incoming.ID] {
			incoming.ID = uuid.NewString()
		}
		usedIDs[incoming.ID] = true
		links = append(links, incoming)
	}
	s.links = links
	return s.saveToFile()
}

func (s *JSONStore) GetLinks() []Link {
	s.mu.RLock()
	defer s.mu.RUnlock()
	links := make([]Link, len(s.links))
	copy(links, s.links)
	return links
}

func (s *JSONStore) GetCategories() *Category {
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

func (s *JSONStore) saveToFile() error {
	data, err := json.MarshalIndent(s.links, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.file, data, 0644)
}
