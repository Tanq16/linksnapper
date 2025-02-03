package api

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"github.com/rs/zerolog/log"
	"github.com/tanq16/linksnapper/internal/models"
	"github.com/tanq16/linksnapper/internal/store"
	"github.com/tanq16/linksnapper/web"
)

type Server struct {
	store *store.Store
}

func NewServer(store *store.Store) *Server {
	return &Server{store: store}
}

func (s *Server) NewRouter() http.Handler {
	mux := http.NewServeMux()

	// Serve static files
	static, err := fs.Sub(web.Assets, "static")
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to setup static file serving")
	}

	// API endpoints
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/links", s.handleLinks)

	// Serve static files, including index.html
	fileServer := http.FileServer(http.FS(static))
	mux.Handle("/", fileServer)

	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleLinks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		links := s.store.GetLinks()
		json.NewEncoder(w).Encode(links)

	case http.MethodPost:
		var link models.Link
		if err := json.NewDecoder(r.Body).Decode(&link); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if err := s.store.AddLink(link); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(link)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
