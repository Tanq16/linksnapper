#!/bin/bash

mkdir -p web/static/css
mkdir -p web/static/js
mkdir -p web/static/webfonts
mkdir -p web/static/fonts

# Download Tailwind CSS and FA CSS
curl -sL "https://cdn.tailwindcss.com" -o "web/static/js/tailwindcss.js"
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" -o "web/static/css/all.min.css"

# Download Font Awesome webfonts
echo "Downloading Font Awesome webfonts..."
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-brands-400.woff2" -o "web/static/webfonts/fa-brands-400.woff2"
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-regular-400.woff2" -o "web/static/webfonts/fa-regular-400.woff2"
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/fa-solid-900.woff2" -o "web/static/webfonts/fa-solid-900.woff2"

# Update the Font Awesome CSS to use the local webfonts path
sed -i.bak 's|https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/webfonts/|/webfonts/|g' web/static/css/all.min.css
rm web/static/css/all.min.css.bak

# Download Inter Font from Google Fonts
curl -sL "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" -o "web/static/css/inter.css"

# Download the actual font files referenced in the downloaded CSS
grep -o "https://fonts.gstatic.com/s/inter/[^)]*" web/static/css/inter.css | while read -r url; do
  clean_url=$(echo "$url" | tr -d "'")
  filename=$(basename "$clean_url")
  curl -sL "$clean_url" -o "web/static/fonts/$filename"
done

# Update the Inter font CSS to use the local font files
sed -i.bak 's|https://fonts.gstatic.com/s/inter/v[0-9]*/|/fonts/|g' web/static/css/inter.css
rm web/static/css/inter.css.bak

echo "All assets downloaded successfully!"
