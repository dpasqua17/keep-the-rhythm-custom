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
- **Omarchy integration**: Auto-opens Chromium on workspace 5 using direct YouTube watch URLs (bypasses webapp capture)
- **Autoplay launch**: Starts Chromium with autoplay policy enabled to begin playback without extra clicks
- **Audio fade**: Smooth 2-second fade in/out when starting/pausing

### 4. **Automatic Offline Recovery Backfill** 🔄

Recovers missed changes to `#writing` files made while the plugin was inactive:

- Runs automatically on startup and periodically while Obsidian is open (default: 60 minutes)
- Uses file `mtime` to assign recovered deltas by day
- Recomputes completed-goal days/streaks after recovery
- Avoids duplicate counting on repeated runs
- Reconciles deleted tracked files from offline periods
- Shows run status in the sidebar
- No manual recovery command is required

### 5. **Fork Identification**

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

This automatically moves the Chromium window to workspace 5 when the sprint timer opens YouTube in Chromium.

### Using the Sprint Timer

1. **Start**: Click "Start" → Chromium opens on workspace 5 with a direct `youtube.com/watch` URL and LoFi music (autoplays)
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
- **Enable Periodic Backfill**: Toggle hourly/interval recovery checks
- **Backfill Interval (minutes)**: Configure periodic recovery cadence (minimum 5, default 60)
- **Sprint Durations**: Customize work/break times
- **Feature Toggles**: Enable/disable streak calendar and sprint timer

### Files Changed

- `src/core/events.ts` - Tag filtering logic
- `src/core/tagFilter.ts` - Shared metadata/content tag detection
- `src/core/backfillLogic.ts` - Backfill helper logic (baseline, clamping, idempotency)
- `src/ui/components/StreakCalendar.tsx` - Streak calendar component
- `src/ui/components/SprintTimer.tsx` - Sprint timer UI
- `src/ui/components/SidebarView.tsx` - Backfill status display
- `src/core/SprintManager.ts` - Sprint logic and browser management
- `src/main.ts` - Startup/periodic backfill orchestration
- `src/defs/types.ts` - Added backfill settings/status and tracking types
- `src/ui/settings/SettingSchema.ts` - Backfill settings fields
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

**If backfill results seem stale:**

1. Check "Enable Periodic Backfill" is enabled in plugin settings
2. Verify your "Backfill Interval (minutes)" is reasonable
3. Open the sidebar and check the "Backfill" status card timestamps/counts
4. Reload Obsidian once to force a startup backfill pass

## 📊 Feature Comparison

| Feature                | Original     | This Fork            |
| ---------------------- | ------------ | -------------------- |
| Word count tracking    | ✅ All files | ✅ Filtered by tag   |
| Offline recovery       | ❌           | ✅ Startup + periodic |
| Heatmap                | ✅           | ✅                   |
| Streak tracking        | ✅ Basic     | ✅ Enhanced calendar |
| Sprint timer           | ❌           | ✅                   |
| LoFi audio integration | ❌           | ✅                   |
| Omarchy integration    | ❌           | ✅                   |

---

**Last Updated**: February 2026  
**Custom Features**: Tag filtering, offline recovery backfill, streak calendar, sprint timer with Omarchy
