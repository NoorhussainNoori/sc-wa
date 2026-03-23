#!/bin/sh
set -e

# Wait/retry migrations (useful when Postgres container is still booting).
i=0
until python manage.py migrate --noinput; do
  i=$((i + 1))
  if [ "$i" -ge 20 ]; then
    echo "Migration failed after multiple retries."
    exit 1
  fi
  echo "Database not ready yet, retrying in 3s..."
  sleep 3
done

python manage.py collectstatic --noinput

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout 120
