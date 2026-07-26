#!/usr/bin/env bash
set -euo pipefail

# Applies the AWL required checks to the protected branch.
#
# Requirements:
#   gh auth login -h github.com
#   gh auth refresh -h github.com -s repo
#
# Usage:
#   scripts/apply-awl-branch-protection.sh
#   BRANCH=develop scripts/apply-awl-branch-protection.sh

REPO="${REPO:-shahisoftai/Neurecore-2026}"
BRANCH="${BRANCH:-main}"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "architecture",
      "focused-tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

echo "Applied AWL branch protection to ${REPO}:${BRANCH}"
