#!/usr/bin/env bash

set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <supabase-project-ref>"
  exit 1
fi

PROJECT_REF="$1"

NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 login
NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 link --project-ref "$PROJECT_REF"
NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 db push --include-all

echo
echo "Supabase production setup complete for project ref: $PROJECT_REF"
echo "Next: create your owner user in the app, then run supabase/sql/bootstrap_admin.sql"
