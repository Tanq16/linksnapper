package models

type Link struct {
	ID          string   `json:"id"`
	URL         string   `json:"url"`
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	Path        []string `json:"path"`
}

type Category struct {
	Name       string               `json:"name"`
	Path       []string             `json:"path"`
	Categories map[string]*Category `json:"categories,omitempty"`
}

// NewCategory creates a new Category with the given name and path
func NewCategory(name string, path []string) *Category {
	return &Category{
		Name:       name,
		Path:       path,
		Categories: make(map[string]*Category),
	}
}
