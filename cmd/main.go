package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/tanq16/linksnapper/internal"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})

	dataDir := filepath.Join("data")
	store, err := internal.NewStore(dataDir)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize store")
	}

	server := internal.NewServer(store)
	srv := &http.Server{
		Addr:    ":8080",
		Handler: server.NewRouter(),
	}
	go func() {
		log.Info().Msg("Starting server on :8080")
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	// Add graceful shutdown
	healthChecker := internal.NewHealthChecker(store, 48*time.Hour)
	healthChecker.Start()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")
	healthChecker.Stop()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}
	log.Info().Msg("Server stopped gracefully")
}
