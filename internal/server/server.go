package server

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
)

//go:embed static
var staticFiles embed.FS

type Server struct {
	host       string
	port       int
	mux        *http.ServeMux
	httpServer *http.Server
	store      Store
	bookmarks  *BookmarkStore
	dataDir    string
}

func New(host string, port int, store Store, dataDir string) *Server {
	return &Server{
		host:      host,
		port:      port,
		mux:       http.NewServeMux(),
		store:     store,
		bookmarks: NewBookmarkStore(dataDir),
		dataDir:   dataDir,
	}
}

func (s *Server) Setup() error {
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		return err
	}
	s.mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

	s.mux.HandleFunc("/api/health", s.handleHealth)
	s.mux.HandleFunc("/api/links", s.handleLinks)
	s.mux.HandleFunc("/api/categories", s.handleCategories)
	s.mux.HandleFunc("/api/bookmarks", s.handleBookmarks)
	s.mux.HandleFunc("/api/bookmarks/", s.handleBookmarksPath)
	s.mux.HandleFunc("/api/config", s.handleConfigRaw)
	s.mux.HandleFunc("/api/links/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/links/import" {
			s.handleLinksImport(w, r)
			return
		}
		switch r.Method {
		case http.MethodDelete:
			s.handleLinkDelete(w, r)
		case http.MethodPut:
			s.handleLinkEdit(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	s.mux.HandleFunc("/", s.handleIndex)

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", s.host, s.port),
		Handler: s.mux,
	}
	return nil
}

func (s *Server) Run() error {
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	data, err := staticFiles.ReadFile("static/index.html")
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	w.Write(data)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
