package internal

import "time"

type Link struct {
	ID          string    `json:"id"`
	URL         string    `json:"url"`
	Name        string    `json:"name,omitempty"`
	Description string    `json:"description,omitempty"`
	Path        []string  `json:"path"`
	Health      Health    `json:"health"`
	LastChecked time.Time `json:"lastChecked"`
}

type Health struct {
	Status     string `json:"status"`
	StatusCode int    `json:"statusCode,omitempty"`
	Error      string `json:"error,omitempty"`
}

type Category struct {
	Name       string               `json:"name"`
	Path       []string             `json:"path"`
	Categories map[string]*Category `json:"categories,omitempty"`
}

func NewCategory(name string, path []string) *Category {
	return &Category{
		Name:       name,
		Path:       path,
		Categories: make(map[string]*Category),
	}
}
