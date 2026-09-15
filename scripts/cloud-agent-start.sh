#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL when it is installed but not yet running.
if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -h localhost -q 2>/dev/null; then
    if command -v pg_ctlcluster >/dev/null 2>&1; then
      sudo pg_ctlcluster 16 main start 2>/dev/null || sudo pg_ctlcluster 15 main start 2>/dev/null || true
    fi
    sudo service postgresql start 2>/dev/null || true
  fi

  # Ensure the local development database exists.
  if pg_isready -h localhost -q 2>/dev/null; then
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='e8dev'" | grep -q 1 \
      || sudo -u postgres psql -c "CREATE USER e8dev WITH PASSWORD 'e8dev' SUPERUSER;"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='e8dev'" | grep -q 1 \
      || sudo -u postgres psql -c "CREATE DATABASE e8dev OWNER e8dev;"
  fi
fi
