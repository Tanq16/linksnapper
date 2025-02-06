package web

import "embed"

//go:embed static/* static/icon-*.png
var Assets embed.FS
