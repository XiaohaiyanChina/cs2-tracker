#!/bin/sh
# On first deploy, the volume is empty. Copy seed data if db.json doesn't exist.
if [ ! -f /app/data/db.json ]; then
  echo "Initializing database from seed data..."
  cp /app/seed/db.json /app/data/db.json
fi
echo "Starting server..."
exec node server/index.js
