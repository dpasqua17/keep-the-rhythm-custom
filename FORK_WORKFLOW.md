# Keep the Rhythm - Custom Fork

This is a personal fork of the [Keep the Rhythm](https://github.com/benjaminezequiel/keep-the-rhythm) Obsidian plugin with custom modifications.

## 🎯 Custom Modifications

### 1. **Tag-Based Filtering** ✨

Only tracks word counts for files with the `#writing` tag. Configure the tag in plugin settings.

### 2. **Writing Goal Streak Calendar** 🔥

Visual 6-week calendar showing your writing streaks:

- **Green days**: Met your daily writing goal
- **Red days**: Missed your goal
- **Gray days**: No writing activity
- **Stats**: Current streak counter and longest streak

### 3. **Writing Sprint Timer** ⏱️

Pomodoro-style focused writing sessions with LoFi music:

- **Customizable durations**: Default 25 min work / 5 min break
- **5 LoFi videos**: Curated playlist for focus
- **Live word tracking**: See words written during each sprint
- **Omarchy integration**: Auto-opens Chromium on workspace 5
- **Audio fade**: Smooth 2-second fade in/out when starting/pausing

### 4. **Fork Identification**

Modified `manifest.json` to distinguish from original:

- Plugin ID: `keep-the-rhythm-custom`
- Name: "Keep the Rhythm (Custom)"

## 🌿 Branch Structure

| Branch     | Purpose             | Tracks            |
| ---------- | ------------------- | ----------------- |
| `main`     | Clean upstream code | `upstream/master` |
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

## 🚀 Development Workflow

1. Make changes on the `personal` branch
2. Commit your changes
3. Build: `npm run build`
4. Copy `main.js` and `styles.css` to your Obsidian plugins folder
5. Push changes: `git push origin personal`

## 🎵 Sprint Timer Setup (Omarchy)

### Prerequisites

- **Omarchy Linux** with Hyprland
- **Chromium** browser installed
- **pactl** (PulseAudio) for volume control

### Hyprland Window Rule

Already configured in `~/.config/hypr/hyprland.conf`:

```conf
windowrulev2 = workspace 5 silent, class:^(chromium)$
```

This automatically moves the Chromium window to workspace 5 when the sprint timer opens YouTube.

### Using the Sprint Timer

1. **Start**: Click "Start" → Chromium opens on workspace 5 with LoFi music
2. **Pause**: Click "Pause" → Audio fades out (browser stays open)
3. **Resume**: Click "Resume" → Audio fades back in
4. **Stop**: Click "Stop" → Ends sprint, closes browser
5. **Next Video**: Click "Next" → Cycles to next LoFi video

**Note**: The browser automatically closes when Obsidian exits.

## ⚙️ Configuration

### Plugin Settings

All custom features are configurable in Obsidian plugin settings:

- **Writing Tag Filter**: Change from "#writing" to any tag
- **Daily Writing Goal**: Set your target word count
- **Sprint Durations**: Customize work/break times
- **Feature Toggles**: Enable/disable streak calendar and sprint timer

### Files Changed

- `src/core/events.ts` - Tag filtering logic
- `src/ui/components/StreakCalendar.tsx` - Streak calendar component
- `src/ui/components/SprintTimer.tsx` - Sprint timer UI
- `src/core/SprintManager.ts` - Sprint logic and browser management
- `src/defs/types.ts` - Added sprint configuration types
- `manifest.json` - Fork identification

## ⚠️ Important Notes

- **Never commit `main.js` or `styles.css`** - these are build artifacts
- Always work on `personal` branch for modifications
- The `main` branch should remain clean for easy upstream syncing
- When rebasing, conflicts are auto-resolved to keep personal changes
- **Chromium window**: Managed by Hyprland, appears on workspace 5

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

**If Sprint Timer audio doesn't work:**

1. Ensure `pactl` is installed: `which pactl`
2. Check Chromium opens: Try running `chromium --new-window` manually
3. Verify Hyprland window rule: `grep chromium ~/.config/hypr/hyprland.conf`
4. Check workspace 5 exists: `hyprctl workspaces`

**If tag filtering isn't working:**

1. Ensure files have the `#writing` tag (inline or frontmatter)
2. Check the tag filter setting matches your tag exactly
3. Reload Obsidian after changing tag filter

## 📊 Feature Comparison

| Feature                | Original     | This Fork            |
| ---------------------- | ------------ | -------------------- |
| Word count tracking    | ✅ All files | ✅ Filtered by tag   |
| Heatmap                | ✅           | ✅                   |
| Streak tracking        | ✅ Basic     | ✅ Enhanced calendar |
| Sprint timer           | ❌           | ✅                   |
| LoFi audio integration | ❌           | ✅                   |
| Omarchy integration    | ❌           | ✅                   |

---

**Last Updated**: February 2025  
**Custom Features**: Tag filtering, Streak Calendar, Sprint Timer with Omarchy
