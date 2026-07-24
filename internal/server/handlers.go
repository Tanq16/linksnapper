package server

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
)

func (s *Server) handleLinks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		links := s.store.GetLinks()
		json.NewEncoder(w).Encode(links)

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
		if err := s.store.AddLink(link); err != nil {
			if err.Error() == "link already exists" {
				http.Error(w, err.Error(), http.StatusConflict)
			} else {
				log.Printf("ERROR Failed to add link: %v", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(link)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		categories := s.store.GetCategories()
		json.NewEncoder(w).Encode(categories)
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
		log.Printf("ERROR Failed to update link %s: %v", id, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedLink)
}
