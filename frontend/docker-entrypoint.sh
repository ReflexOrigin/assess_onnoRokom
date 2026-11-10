#!/bin/sh
set -e

# Default API URL if not provided
TARGET_API_URL="${VITE_API_BASE_URL:-${API_BASE_URL:-http://localhost:8080}}"

echo "Generating runtime env-config.js with API_BASE_URL=${TARGET_API_URL}"

cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  API_BASE_URL: "${TARGET_API_URL}"
};
EOF

exec "$@"

