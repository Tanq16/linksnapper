package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/goccy/go-yaml"
)

type BookmarkConfig struct {
	Bookmarks []any `yaml:"bookmarks" json:"bookmarks"`
}

func (s *Server) handleBookmarksGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configPath := filepath.Join(s.dataDir, "bookmarks.yaml")
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			json.NewEncoder(w).Encode([]any{})
			return
		}
		log.Printf("ERROR Failed to read bookmarks config: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	var config BookmarkConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		log.Printf("ERROR Failed to parse bookmarks config: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config.Bookmarks)
}

func (s *Server) handleConfigRaw(w http.ResponseWriter, r *http.Request) {
	configPath := filepath.Join(s.dataDir, "bookmarks.yaml")

	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(configPath)
		if err != nil {
			if os.IsNotExist(err) {
				w.Write([]byte("bookmarks:\n"))
				return
			}
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

		var config BookmarkConfig
		if err := yaml.Unmarshal(data, &config); err != nil {
			log.Printf("ERROR Invalid YAML provided: %v", err)
			http.Error(w, "Invalid YAML format", http.StatusBadRequest)
			return
		}

		if err := os.WriteFile(configPath, data, 0644); err != nil {
			log.Printf("ERROR Failed to write bookmarks config: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
