package cmd

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/tanq16/linksnapper/internal/server"
)

var serveFlags struct {
	port int
	host string
	data string
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the web server",
	Run: func(cmd *cobra.Command, args []string) {
		store, err := server.NewStore(serveFlags.data)
		if err != nil {
			log.Fatalf("ERROR Failed to initialize store: %v", err)
		}

		srv := server.New(serveFlags.host, serveFlags.port, store, serveFlags.data)
		if err := srv.Setup(); err != nil {
			log.Fatalf("ERROR Failed to setup server: %v", err)
		}

		healthChecker := server.NewHealthChecker(store, 48*time.Hour)
		healthChecker.Start()

		errCh := make(chan error, 1)
		go func() {
			log.Printf("INFO Starting server on %s:%d", serveFlags.host, serveFlags.port)
			if err := srv.Run(); err != nil {
				errCh <- err
			}
		}()

		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

		select {
		case err := <-errCh:
			log.Fatalf("ERROR Server failed to start: %v", err)
		case <-quit:
		}

		log.Printf("INFO Shutting down server...")
		healthChecker.Stop()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Fatalf("ERROR Server forced to shutdown: %v", err)
		}
		log.Printf("INFO Server stopped gracefully")
	},
}

func init() {
	serveCmd.Flags().IntVarP(&serveFlags.port, "port", "p", 8080, "Port to listen on")
	serveCmd.Flags().StringVarP(&serveFlags.host, "host", "H", "0.0.0.0", "Host to bind to")
	serveCmd.Flags().StringVarP(&serveFlags.data, "data", "d", "data", "Data directory for storage")
}
