package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var AppVersion = "dev-build"

var rootCmd = &cobra.Command{
	Use:     "linksnapper",
	Short:   "A self-hosted bookmark manager",
	Version: AppVersion,
	CompletionOptions: cobra.CompletionOptions{
		HiddenDefaultCmd: true,
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.SetHelpCommand(&cobra.Command{Hidden: true})
	rootCmd.AddCommand(serveCmd)
}
