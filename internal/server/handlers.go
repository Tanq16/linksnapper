package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"slices"
	"strings"
)

func (s *Server) handleLinks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		links := s.store.GetLinks()
		writeJSON(w, http.StatusOK, links)

	case http.MethodPost:
		var link Link
		if err := json.NewDecoder(r.Body).Decode(&link); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		parsedURL, err := url.Parse(link.URL)
		if err != nil {
			http.Error(w, "Invalid URL format", http.StatusBadRequest)
			return
		}
		parsedURL.RawQuery = ""
		parsedURL.Fragment = ""
		link.URL = parsedURL.String()
		if len(link.Path) == 0 {
			link.Path = []string{"Uncategorized"}
		}
		created, err := s.store.AddLink(link)
		if err != nil {
			if err.Error() == "link already exists" {
				http.Error(w, err.Error(), http.StatusConflict)
			} else {
				log.Printf("ERROR Failed to add link: %v", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}
		writeJSON(w, http.StatusCreated, created)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		categories := s.store.GetCategories()
		writeJSON(w, http.StatusOK, categories)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleLinkDelete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/links/")
	if id == "" {
		http.Error(w, "Invalid link ID", http.StatusBadRequest)
		return
	}
	if err := s.store.DeleteLink(id); err != nil {
		if errors.Is(err, ErrLinkNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		log.Printf("ERROR Failed to delete link %s: %v", id, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleLinkEdit(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/links/")
	if id == "" {
		http.Error(w, "Invalid link ID", http.StatusBadRequest)
		return
	}
	var updatedLink Link
	if err := json.NewDecoder(r.Body).Decode(&updatedLink); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.store.UpdateLink(id, updatedLink); err != nil {
		if errors.Is(err, ErrLinkNotFound) {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		log.Printf("ERROR Failed to update link %s: %v", id, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	links := s.store.GetLinks()
	index := slices.IndexFunc(links, func(link Link) bool {
		return link.ID == id
	})
	if index == -1 {
		log.Printf("ERROR Updated link %s was not found", id)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, links[index])
}

func (s *Server) handleLinksImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}
	var links []Link
	mode := r.URL.Query().Get("mode")
	if bytes.HasPrefix(bytes.TrimSpace(raw), []byte("[")) {
		if err := json.Unmarshal(raw, &links); err != nil {
			http.Error(w, "Invalid links import", http.StatusBadRequest)
			return
		}
	} else {
		var envelope struct {
			Links *[]Link `json:"links"`
			Mode  string  `json:"mode"`
		}
		if err := json.Unmarshal(raw, &envelope); err != nil {
			http.Error(w, "Invalid links import", http.StatusBadRequest)
			return
		}
		if envelope.Links == nil {
			http.Error(w, "links field is required", http.StatusBadRequest)
			return
		}
		links = *envelope.Links
		if mode == "" {
			mode = envelope.Mode
		}
	}
	if mode == "" {
		mode = "merge"
	}
	if mode != "merge" && mode != "replace" {
		http.Error(w, "mode must be merge or replace", http.StatusBadRequest)
		return
	}
	if err := s.store.ImportLinks(links, mode); err != nil {
		log.Printf("ERROR Failed to import links: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("ERROR Failed to encode JSON response: %v", err)
	}
}
