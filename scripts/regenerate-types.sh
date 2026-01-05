#!/bin/bash
# Script to regenerate Supabase types
# Usage: ./scripts/regenerate-types.sh

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Get project reference from environment or prompt
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "Please set SUPABASE_PROJECT_REF environment variable"
    echo "Or run: export SUPABASE_PROJECT_REF=your-project-ref"
    exit 1
fi

# Generate types
echo "Generating Supabase types..."
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > types/supabase.ts

echo "Types regenerated successfully!"
echo "Please verify that waitlist_enabled appears in the sessions table definition."

