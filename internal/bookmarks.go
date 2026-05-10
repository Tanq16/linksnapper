package internal

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
	"github.com/rs/zerolog/log"
)

type BookmarkConfig struct {
	Bookmarks []interface{} `yaml:"bookmarks" json:"bookmarks"`
}

func (s *Server) handleBookmarksGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configPath := filepath.Join("data", "bookmarks.yaml")
	data, err := ioutil.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			json.NewEncoder(w).Encode([]interface{}{})
			return
		}
		log.Error().Err(err).Msg("Failed to read bookmarks config")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	var config BookmarkConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		log.Error().Err(err).Msg("Failed to parse bookmarks config")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config.Bookmarks)
}

func (s *Server) handleConfigRaw(w http.ResponseWriter, r *http.Request) {
	configPath := filepath.Join("data", "bookmarks.yaml")

	switch r.Method {
	case http.MethodGet:
		data, err := ioutil.ReadFile(configPath)
		if err != nil {
			if os.IsNotExist(err) {
				w.Write([]byte("bookmarks:\n"))
				return
			}
			log.Error().Err(err).Msg("Failed to read bookmarks config")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write(data)

	case http.MethodPost:
		data, err := ioutil.ReadAll(r.Body)
		if err != nil {
			log.Error().Err(err).Msg("Failed to read request body")
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		// Validate YAML before saving
		var config BookmarkConfig
		if err := yaml.Unmarshal(data, &config); err != nil {
			log.Error().Err(err).Msg("Invalid YAML provided")
			http.Error(w, "Invalid YAML format", http.StatusBadRequest)
			return
		}

		if err := ioutil.WriteFile(configPath, data, 0644); err != nil {
			log.Error().Err(err).Msg("Failed to write bookmarks config")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
