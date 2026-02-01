#!/bin/bash
# sync-upstream.sh - Sync upstream changes and rebase personal modifications
# Usage: ./sync-upstream.sh

set -e

echo "🔄 Syncing with upstream..."

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)

# Stash any uncommitted changes on current branch
if [[ -n $(git status --porcelain) ]]; then
    echo "📦 Stashing uncommitted changes..."
    git stash push -m "WIP before sync: $(date)"
    STASHED=true
else
    STASHED=false
fi

# Update main from upstream
echo "⬇️  Fetching upstream updates..."
git checkout main
git fetch upstream
git reset --hard upstream/master

# Push updated main to origin
echo "⬆️  Pushing main to origin..."
git push origin main --force-with-lease

# Rebase personal onto updated main
echo "🔀 Rebasing personal branch onto updated main..."
git checkout personal

# Attempt rebase, if conflicts occur, use ours (keep personal changes)
if ! git rebase main; then
    echo "⚠️  Conflicts detected during rebase. Resolving using personal version (Option A)..."
    
    # Keep resolving conflicts using "ours" strategy (personal changes)
    while git diff --name-only --diff-filter=U | grep -q .; do
        git diff --name-only --diff-filter=U | while read file; do
            echo "   Resolving conflict in: $file"
            git checkout --ours "$file"
            git add "$file"
        done
        
        # Continue rebase
        if ! git rebase --continue 2>/dev/null; then
            # Check if rebase is complete
            if [[ ! -d .git/rebase-merge ]] && [[ ! -d .git/rebase-apply ]]; then
                break
            fi
        fi
    done
    
    echo "✅ Conflicts resolved. Personal changes preserved."
fi

# Push rebased personal branch
echo "⬆️  Pushing personal to origin (force-with-lease)..."
git push origin personal --force-with-lease

# Return to original branch
if [[ "$CURRENT_BRANCH" != "personal" ]]; then
    git checkout "$CURRENT_BRANCH"
fi

# Restore stashed changes
if [[ "$STASHED" == true ]]; then
    echo "📦 Restoring stashed changes..."
    git stash pop
fi

echo ""
echo "✨ Sync complete!"
echo "   • main: now synced with upstream"
echo "   • personal: rebased on top of upstream with your #writing tag changes"
echo ""
echo "📝 Current branches:"
git branch -vv
