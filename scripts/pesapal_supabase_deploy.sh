#!/usr/bin/env bash

set -euo pipefail

PROJECT_REF="csrrnirpgkqjhvqcyxjp"

echo "Pesapal Supabase deploy helper"
echo
echo "Project ref: $PROJECT_REF"
echo "IPN URL: https://$PROJECT_REF.supabase.co/functions/v1/pesapal-ipn"
echo
echo "Before running anything, confirm these secrets exist in Supabase:"
echo "  PESAPAL_ENVIRONMENT"
echo "  PESAPAL_CONSUMER_KEY"
echo "  PESAPAL_CONSUMER_SECRET"
echo "  PESAPAL_AUTH_URL"
echo "  PESAPAL_NOTIFICATION_ID"
echo "  PESAPAL_SUBMIT_ORDER_URL (optional)"
echo "  PESAPAL_TRANSACTION_STATUS_URL (optional)"
echo "  PESAPAL_IPN_URL"
echo
echo "Suggested manual deploy sequence:"
echo
echo "1. Link the project if needed:"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 login"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 link --project-ref $PROJECT_REF"
echo
echo "2. Push database changes:"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 db push --include-all"
echo
echo "3. Deploy the Pesapal edge functions:"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 functions deploy create-pesapal-checkout"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 functions deploy sync-pesapal-couple-checkout"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 functions deploy sync-pesapal-professional-checkout"
echo "   NPM_CONFIG_CACHE=/tmp/.npm-cache npx --yes supabase@2.77.0 functions deploy pesapal-ipn"
echo
echo "4. Register the IPN URL in Pesapal:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/pesapal-ipn"
echo
echo "5. After sandbox verification, switch Vercel env:"
echo "   VITE_BILLING_PROVIDER=pesapal"
