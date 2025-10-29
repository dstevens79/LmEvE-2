#!/bin/bash

# Script to move all .md files (except README.md and prd.md) to docs folder

# List of markdown files to move
files=(
    "CURRENT_WORKING_STATE.md"
    "DATABASE_SCHEMAS.md"
    "ESI-PI-TRACKING-GUIDE.md"
    "FIXED_ISSUES.md"
    "FORCE_PUSH_STATE.md"
    "IMPLEMENTATION_REPORT.md"
    "IMPLEMENTATION_SUMMARY.md"
    "NOTIFICATION_SYSTEM.md"
    "PRESERVE_CURRENT_STATE.md"
    "PROJECTS_HANGAR_SYSTEM.md"
    "PROJECT_MILESTONE.md"
    "RECOVERY_PLAN.md"
    "WORKING_STATE_CHECKPOINT.md"
    "WORKING_STATE_VERIFIED.md"
    "admin-login-test-results-updated.md"
    "admin-login-test-results.md"
    "database-setup-analysis.md"
    "debug-auth.md"
    "test-login.md"
)

# Create docs directory if it doesn't exist
mkdir -p docs

# Copy each file to docs folder
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Moving $file to docs/"
        cp "$file" "docs/$file"
        rm "$file"
    else
        echo "File not found: $file (skipping)"
    fi
done

echo "Done! All files moved to docs/"
