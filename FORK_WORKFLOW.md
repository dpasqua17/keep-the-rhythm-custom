# Keep the Rhythm - Custom Fork

This is a personal fork of the [Keep the Rhythm](https://github.com/benjaminezequiel/keep-the-rhythm) Obsidian plugin with custom modifications.

## 🎯 Custom Modifications

- **Tag-based filtering**: Only tracks word counts for files with the `#writing` tag
- **Running properly**: Fixed compatibility issues

## 🌿 Branch Structure

| Branch | Purpose | Tracks |
|--------|---------|--------|
| `main` | Clean upstream code | `upstream/master` |
| `personal` | Your customizations | `origin/personal` |

## 🔄 Syncing with Upstream

When the original plugin releases updates, run:

```bash
./sync-upstream.sh
```

This will:
1. Update `main` from upstream
2. Rebase `personal` onto the updated `main`
3. Automatically resolve conflicts by keeping your changes (Option A)
4. Push both branches to your GitHub fork

## 📋 Manual Sync Commands

If you prefer manual control:

```bash
# Fetch upstream updates
git fetch upstream

# Update main
git checkout main
git reset --hard upstream/master
git push origin main

# Rebase personal
git checkout personal
git rebase main
# Resolve any conflicts (keep personal changes)
git push origin personal --force-with-lease
```

## 🔧 Git Setup (Already Done)

The repository is configured with:
- `upstream`: https://github.com/benjaminezequiel/keep-the-rhythm
- `origin`: https://github.com/dpasqua17/keep-the-rhythm-custom
- Credential helper: GitHub CLI for seamless authentication

## 🚀 Development Workflow

1. Make changes on the `personal` branch
2. Commit your changes
3. Build: `npm run build`
4. Copy `main.js` and `styles.css` to your Obsidian plugins folder
5. Push changes: `git push origin personal`

## ⚠️ Important Notes

- **Never commit `main.js` or `styles.css`** - these are build artifacts
- Always work on `personal` branch for modifications
- The `main` branch should remain clean for easy upstream syncing
- When rebasing, conflicts are auto-resolved to keep personal changes

## 📁 Repository

- **Fork URL**: https://github.com/dpasqua17/keep-the-rhythm-custom
- **Upstream**: https://github.com/benjaminezequiel/keep-the-rhythm

## 🆘 Troubleshooting

**If sync-upstream.sh fails:**
1. Check you're authenticated: `gh auth status`
2. Verify remotes: `git remote -v`
3. Manual rebase: Follow the "Manual Sync Commands" section

**If Obsidian plugin doesn't work after update:**
1. Run `npm install` to ensure dependencies are up to date
2. Run `npm run build` to rebuild
3. Restart Obsidian
