import {
	Plugin,
	TFile,
	TAbstractFile,
	Notice,
	moment as _moment,
} from "obsidian";

import {
	ColorConfig,
	DEFAULT_SETTINGS,
	FileTrackingSnapshot,
	STARTING_STATS,
	PluginData,
	Unit,
} from "@/defs/types";

import { getDB, initDatabase } from "@/db/db";
import { EVENTS, state } from "@/core/pluginState";
import { PluginView, VIEW_TYPE } from "@/ui/views/PluginView";
import { migrateDataFromOldFormat } from "@/utils/migrateData";
import { SettingsTab } from "@/ui/settings/SettingsTab";

import {
	floorMomentToFive,
	formatDate,
	scheduleNextDayTrigger,
} from "@/utils/dateUtils";

import * as utils from "@/utils/utils";
import * as events from "@/core/events";
import * as codeBlocks from "@/core/codeBlocks";
import { checkPreviousStreak, activateSidebarView } from "@/core/commands";
import { SprintManager } from "@/core/SprintManager";
import { DailyActivity } from "@/db/types";
import { getLanguageBasedWordCount } from "@/core/wordCounting";
import { contentHasTag, fileHasTagFromCache } from "@/core/tagFilter";
import {
	areCountsAlreadyTracked,
	chooseBackfillBaseline,
	clampBackfillIntervalMinutes,
	computeCompletedDatesFromDeltas,
	DailyWordDelta,
	LatestTrackedCounts,
	resolveBackfillDate,
} from "@/core/backfillLogic";

const moment = _moment as unknown as typeof _moment.default;

interface BackfillSummary {
	taggedFiles: number;
	changedFiles: number;
	updatedActivities: number;
	deletedFilesReconciled: number;
	fastSkippedFiles: number;
	totalWordDelta: number;
	totalCharDelta: number;
}

export default class KeepTheRhythm extends Plugin {
	data: PluginData = {
		schema: "0.2",
		settings: DEFAULT_SETTINGS,
		stats: {
			dailyActivity: [],
		},
	};

	private dayTimer: number | null = null;
	private periodicBackfillTimer: number | null = null;
	private isBackfillInProgress: boolean = false;
	private JSON_DEBOUNCE_TIME = 1000;
	private DEFAULT_BACKFILL_INTERVAL_MINUTES = 60;
	private MIN_BACKFILL_INTERVAL_MINUTES = 5;
	private MAX_BACKFILL_INTERVAL_MINUTES = 24 * 60;
	private LAST_BREAKING_CHANGE_TO_SCHEMA = "0.2";

	private JsonDebounceTimeout: any = null;

	async onload() {
		state.setPlugin(this);
		this.dayTimer = scheduleNextDayTrigger(() => {
			this.updateAndSaveEverything(); // or just refresh heatmap
		});

		initDatabase();

		// todo: check if this is really necessary
		getDB().dailyActivity.clear(); // restarts DB to ensure data.json is the source of truth

		/////////
		const loadedData = await this.loadData();

		if (loadedData) {
			// add setting to remove backups
			try {
				await this.backupDataToVaultFolder(loadedData);
			} catch (err) {
				console.error("KTR Error trying to create backup: ", err);
			}
		}

		/** Data is only loaded into dexie if it's the correct schema */
		if (
			loadedData &&
			loadedData.schema == this.LAST_BREAKING_CHANGE_TO_SCHEMA
		) {
			await this.initializeDataFromJSON(loadedData);
		} else if (
			loadedData &&
			loadedData.schema !== this.LAST_BREAKING_CHANGE_TO_SCHEMA
		) {
			new Notice("KTR: Migrating data from previous versions...");
			await this.migrateDataFromJSON(loadedData);
		} else if (!loadedData) {
			this.data.schema = this.LAST_BREAKING_CHANGE_TO_SCHEMA;
			this.data.stats = {
				...STARTING_STATS,
			};
		} else {
			this.data.stats = loadedData.stats;
			this.data.settings = loadedData.settings;
		}

		state.setToday();

		await this.runBackfillAndRefreshMetrics("startup");

		/** Initialize SIDEBAR view */
		this.registerView(VIEW_TYPE, (leaf) => {
			return new PluginView(leaf, this);
		});

		this.initializeCommands();
		this.initializeEvents();
		this.applyColorStyles();
		this.addSettingTab(new SettingsTab(this.app, this));

		/** Registers CUSTOM CODE BLOCKS */
		this.registerMarkdownCodeBlockProcessor(
			"ktr-heatmap",
			codeBlocks.createHeatmapCodeBlock,
		);

		this.registerMarkdownCodeBlockProcessor(
			"ktr-slots",
			codeBlocks.createSlotsCodeBlock,
		);

		this.registerMarkdownCodeBlockProcessor(
			"ktr-entries",
			codeBlocks.createEntriesCodeBlock,
		);

		state.on(EVENTS.REFRESH_EVERYTHING, async () => {
			if (this.JsonDebounceTimeout) {
				clearTimeout(this.JsonDebounceTimeout);
			}

			this.JsonDebounceTimeout = setTimeout(async () => {
				await this.saveDataToJSON();
			}, this.JSON_DEBOUNCE_TIME);
		});

		this.startPeriodicBackfill();
	}

	private startPeriodicBackfill() {
		if (this.periodicBackfillTimer !== null) {
			window.clearInterval(this.periodicBackfillTimer);
		}

		if (!this.data.settings.enablePeriodicBackfill) {
			this.periodicBackfillTimer = null;
			return;
		}

		const intervalMs = this.getBackfillIntervalMs();
		this.periodicBackfillTimer = window.setInterval(() => {
			void this.runBackfillAndRefreshMetrics("hourly");
		}, intervalMs);
	}

	private getBackfillIntervalMinutes(): number {
		return clampBackfillIntervalMinutes(
			this.data.settings?.backfillIntervalMinutes,
			this.DEFAULT_BACKFILL_INTERVAL_MINUTES,
			this.MIN_BACKFILL_INTERVAL_MINUTES,
			this.MAX_BACKFILL_INTERVAL_MINUTES,
		);
	}

	private getBackfillIntervalMs(): number {
		return this.getBackfillIntervalMinutes() * 60 * 1000;
	}

	private async runBackfillAndRefreshMetrics(
		source: "startup" | "hourly",
	): Promise<void> {
		if (this.isBackfillInProgress) return;

		this.isBackfillInProgress = true;
		const startedAt = Date.now();

		try {
			events.cleanDBTimeout();

			const today = formatDate(new Date());
			if (today !== state.today) {
				state.setToday();
			}

			const summary = await this.backfillWritingFileChangesFromMtime();
			const streakChanged = await this.recomputeGoalCompletionDays();
			await this.checkVaultCountStaleness();
			const durationMs = Date.now() - startedAt;

			if (this.data.stats) {
				this.data.stats.backfillStatus = {
					lastRunAt: new Date().toISOString(),
					source,
					tagFilter: this.data.settings.writingTagFilter || "",
					intervalMinutes: this.getBackfillIntervalMinutes(),
					taggedFiles: summary.taggedFiles,
					changedFiles: summary.changedFiles,
					updatedActivities: summary.updatedActivities,
					deletedFilesReconciled: summary.deletedFilesReconciled,
					fastSkippedFiles: summary.fastSkippedFiles,
					totalWordDelta: summary.totalWordDelta,
					totalCharDelta: summary.totalCharDelta,
					durationMs,
				};
			}

			await this.saveDataToJSON();

			if (summary.updatedActivities > 0 || streakChanged) {
				state.emit(EVENTS.REFRESH_EVERYTHING);
			}

			console.info(
				`KTR: ${source} backfill complete | tagged=${summary.taggedFiles} changed=${summary.changedFiles} entries=${summary.updatedActivities} deleted=${summary.deletedFilesReconciled} skipped=${summary.fastSkippedFiles} wordDelta=${summary.totalWordDelta} charDelta=${summary.totalCharDelta}`,
			);
		} catch (error) {
			console.error(`KTR: Error running ${source} backfill`, error);
		} finally {
			this.isBackfillInProgress = false;
		}
	}

	private isNewerActivity(
		newActivity: DailyActivity,
		currentActivity: DailyActivity,
	): boolean {
		if (newActivity.date !== currentActivity.date) {
			return newActivity.date > currentActivity.date;
		}

		return (newActivity.id || 0) > (currentActivity.id || 0);
	}

	private resolveBackfillDate(
		mtimeDate: string,
		baselineDate: string,
	): string {
		return resolveBackfillDate(mtimeDate, baselineDate);
	}

	private async applyBackfilledDelta(
		filePath: string,
		date: string,
		timeKey: string,
		wordCountStart: number,
		charCountStart: number,
		wordDelta: number,
		charDelta: number,
	): Promise<void> {
		const existingActivity = await getDB()
			.dailyActivity.where("[date+filePath]")
			.equals([date, filePath])
			.first();

		if (!existingActivity) {
			await getDB().dailyActivity.add({
				date,
				filePath,
				wordCountStart,
				charCountStart,
				changes: [
					{
						timeKey,
						w: wordDelta,
						c: charDelta,
					},
				],
			});
			return;
		}

		const existingChange = existingActivity.changes.find(
			(change) => change.timeKey === timeKey,
		);

		if (existingChange) {
			existingChange.w += wordDelta;
			existingChange.c += charDelta;
		} else {
			existingActivity.changes.push({
				timeKey,
				w: wordDelta,
				c: charDelta,
			});
		}

		existingActivity.changes.sort((a, b) =>
			a.timeKey.localeCompare(b.timeKey),
		);
		await getDB().dailyActivity.put(existingActivity);
	}

	private async backfillWritingFileChangesFromMtime(): Promise<BackfillSummary> {
		if (!this.data.stats) {
			return {
				taggedFiles: 0,
				changedFiles: 0,
				updatedActivities: 0,
				deletedFilesReconciled: 0,
				fastSkippedFiles: 0,
				totalWordDelta: 0,
				totalCharDelta: 0,
			};
		}

		const allActivities = await getDB().dailyActivity.toArray();
		const latestActivityRecords = new Map<string, DailyActivity>();

		for (const activity of allActivities) {
			const existing = latestActivityRecords.get(activity.filePath);
			if (!existing || this.isNewerActivity(activity, existing)) {
				latestActivityRecords.set(activity.filePath, activity);
			}
		}

		const latestActivityByPath = new Map<string, LatestTrackedCounts>();
		for (const [filePath, activity] of latestActivityRecords.entries()) {
			const totals = utils.sumBothTimeEntries(activity);
			latestActivityByPath.set(filePath, {
				date: activity.date,
				totalWords: totals.totalWords,
				totalChars: totals.totalChars,
			});
		}

		if (!this.data.stats.fileSnapshots) {
			this.data.stats.fileSnapshots = {};
		}

		const fileSnapshots = this.data.stats.fileSnapshots as Record<
			string,
			FileTrackingSnapshot
		>;

		let taggedFiles = 0;
		let changedFiles = 0;
		let updatedActivities = 0;
		let deletedFilesReconciled = 0;
		let fastSkippedFiles = 0;
		let totalWordDelta = 0;
		let totalCharDelta = 0;
		const taggedPaths = new Set<string>();
		const existingPaths = new Set<string>();
		const files = this.app.vault.getMarkdownFiles();
		const now = Date.now();
		const nowDate = formatDate(new Date(now));
		const nowTimeKey = floorMomentToFive(moment(now)).format("HH:mm");
		const currentTagFilter = this.data.settings.writingTagFilter || "";
		const previousTagFilter = this.data.stats.backfillStatus?.tagFilter;
		const tagFilterChanged =
			typeof previousTagFilter === "string" &&
			previousTagFilter !== currentTagFilter;

		for (const file of files) {
			existingPaths.add(file.path);
			const snapshot = fileSnapshots[file.path];
			const safeMtime = Math.min(file.stat.mtime || now, now);
			const mtimeDate = formatDate(new Date(safeMtime));
			const timeKey = floorMomentToFive(moment(safeMtime)).format(
				"HH:mm",
			);
			const latestActivity = latestActivityByPath.get(file.path) || null;

			const canSkipReadWithSnapshot =
				!!snapshot &&
				!tagFilterChanged &&
				safeMtime <= snapshot.lastModified;
			if (canSkipReadWithSnapshot) {
				taggedPaths.add(file.path);
				taggedFiles++;
				fastSkippedFiles++;
				continue;
			}

			const cachedTagResult = fileHasTagFromCache(
				file,
				currentTagFilter,
				this.app.metadataCache,
			);
			if (cachedTagResult === false) continue;

			const content = await this.app.vault.read(file);
			const hasTag = contentHasTag(content, currentTagFilter);
			if (!hasTag) continue;

			taggedFiles++;
			taggedPaths.add(file.path);

			const currentWordCount = getLanguageBasedWordCount(
				content,
				this.data.settings.enabledLanguages,
			);
			const currentCharCount = content.length;

			if (
				areCountsAlreadyTracked(
					currentWordCount,
					currentCharCount,
					latestActivity,
					snapshot,
				)
			) {
				fileSnapshots[file.path] = {
					wordCount: currentWordCount,
					charCount: currentCharCount,
					lastModified: safeMtime,
				};
				continue;
			}

			const baseline = chooseBackfillBaseline(
				latestActivity,
				snapshot,
				safeMtime,
			);

			// Skip backfill for files already tracked today - live editing captures changes
			if (latestActivity && latestActivity.date === state.today) {
				fileSnapshots[file.path] = {
					wordCount: currentWordCount,
					charCount: currentCharCount,
					lastModified: safeMtime,
				};
				continue;
			}

			if (baseline) {
				const baselineWordCount = baseline.wordCount;
				const baselineCharCount = baseline.charCount;
				const baselineDate = baseline.date;
				const wordDelta = currentWordCount - baselineWordCount;
				const charDelta = currentCharCount - baselineCharCount;

				if (wordDelta !== 0 || charDelta !== 0) {
					const backfillDate = this.resolveBackfillDate(
						mtimeDate,
						baselineDate,
					);

					await this.applyBackfilledDelta(
						file.path,
						backfillDate,
						timeKey,
						baselineWordCount,
						baselineCharCount,
						wordDelta,
						charDelta,
					);

					changedFiles++;
					updatedActivities++;
					totalWordDelta += wordDelta;
					totalCharDelta += charDelta;
				}
			}

			fileSnapshots[file.path] = {
				wordCount: currentWordCount,
				charCount: currentCharCount,
				lastModified: safeMtime,
			};
		}

		for (const path of Object.keys(fileSnapshots)) {
			const snapshot = fileSnapshots[path];

			if (!existingPaths.has(path)) {
				const latestActivity = latestActivityByPath.get(path) || null;
				const baselineWordCount =
					latestActivity?.totalWords ?? snapshot.wordCount;
				const baselineCharCount =
					latestActivity?.totalChars ?? snapshot.charCount;

				if (baselineWordCount !== 0 || baselineCharCount !== 0) {
					await this.applyBackfilledDelta(
						path,
						nowDate,
						nowTimeKey,
						baselineWordCount,
						baselineCharCount,
						-baselineWordCount,
						-baselineCharCount,
					);
					changedFiles++;
					updatedActivities++;
					deletedFilesReconciled++;
					totalWordDelta -= baselineWordCount;
					totalCharDelta -= baselineCharCount;
				}

				delete fileSnapshots[path];
				continue;
			}

			if (!taggedPaths.has(path)) {
				delete fileSnapshots[path];
			}
		}

		if (this.data.stats.wholeVaultWordCount !== undefined) {
			this.data.stats.wholeVaultWordCount += totalWordDelta;
		}
		if (this.data.stats.wholeVaultCharCount !== undefined) {
			this.data.stats.wholeVaultCharCount += totalCharDelta;
		}

		return {
			taggedFiles,
			changedFiles,
			updatedActivities,
			deletedFilesReconciled,
			fastSkippedFiles,
			totalWordDelta,
			totalCharDelta,
		};
	}

	private async recomputeGoalCompletionDays(): Promise<boolean> {
		if (!this.data.stats) return false;

		const previousCompletedDates = [
			...(this.data.stats.daysWithCompletedGoal || []),
		].sort();
		const previousCurrentStreak = this.data.stats.currentStreak || 0;
		const previousHighestStreak = this.data.stats.highestStreak || 0;

		const activities = await getDB().dailyActivity.toArray();
		const wordDeltas: DailyWordDelta[] = activities.map((activity) => ({
			date: activity.date,
			wordDelta: utils.sumTimeEntries(activity, Unit.WORD, true),
		}));

		const dailyGoal =
			this.data.settings.dailyWritingGoal ||
			DEFAULT_SETTINGS.dailyWritingGoal;
		const completedDates = computeCompletedDatesFromDeltas(
			wordDeltas,
			dailyGoal,
		);

		this.data.stats.daysWithCompletedGoal = completedDates;

		const { currentStreak, longestStreak } =
			utils.getDateStreaks(completedDates);
		this.data.stats.currentStreak = currentStreak;
		this.data.stats.highestStreak = longestStreak;

		const datesChanged =
			previousCompletedDates.length !== completedDates.length ||
			previousCompletedDates.some(
				(date, index) => date !== completedDates[index],
			);
		const streakChanged =
			previousCurrentStreak !== currentStreak ||
			previousHighestStreak !== longestStreak;

		return datesChanged || streakChanged;
	}

	private async checkVaultCountStaleness() {
		if (
			this.data.stats?.wholeVaultWordCount !== undefined &&
			this.data.stats?.wholeVaultCharCount !== undefined
		) {
			const recentActivity = await getDB()
				.dailyActivity.orderBy("date")
				.reverse()
				.first();

			if (recentActivity) {
				const daysSinceLastActivity = moment().diff(
					moment(recentActivity.date),
					"days",
				);
				if (daysSinceLastActivity > 7) {
					this.data.stats.wholeVaultWordCount = undefined;
					this.data.stats.wholeVaultCharCount = undefined;
					await this.saveData(this.data);
				}
			}
		}
	}

	private async backupDataToVaultFolder(data: any) {
		const backupConfig =
			data.settings.backupConfig || this.data.settings.backupConfig;

		// Check if backups are enabled
		if (!backupConfig.enabled) {
			console.log("KTR: Backups disabled, ignoring");
			return;
		}

		const folderPath = backupConfig.folderPath || ".keep-the-rhythm";
		const fileName = `backup-${formatDate(new Date())}-${data.schema}.json`;
		const backupPath = `${folderPath}/${fileName}`;
		const jsonData = JSON.stringify(data, null, 2);

		const folderExists = await this.app.vault.adapter.exists(folderPath);

		if (!folderExists) {
			await this.app.vault.adapter.mkdir(folderPath);
		}

		const filesOnBackupsFolder =
			await this.app.vault.adapter.list(folderPath);
		const backupFiles = filesOnBackupsFolder.files.filter((f) =>
			f.endsWith(".json"),
		);

		// Clean backups based on user preference
		const maxBackups = backupConfig.maxNumberOfBackups || 3;
		if (backupFiles.length >= maxBackups) {
			await this.cleanOlderBackups(backupFiles, maxBackups);
		}

		console.log(backupPath);
		// This if runs if the user has data from previous schemas, checking
		// every backup to see if the data was already backed up and saving it otherwise.
		if (data.schema !== "0.3") {
			// Compare against all existing backups
			for (const filePath of backupFiles) {
				try {
					if (!(await this.app.vault.adapter.exists(filePath))) {
						console.error("File does not exist:", filePath);
						return;
					}
					const contents =
						await this.app.vault.adapter.read(filePath);
					if (contents && contents === jsonData) {
						return;
					}
				} catch (err) {
					console.error("Failed to read file:", filePath, err);
					return null;
				}
			}
			// No identical backup found, save new one
			await this.app.vault.adapter.write(backupPath, jsonData);
			new Notice("KTR: New backup saved.");
		} else {
			await this.app.vault.adapter.write(backupPath, jsonData);
			new Notice("KTR: First backup created.");
		}
	}

	private async cleanOlderBackups(backupPaths: string[], maxBackups: number) {
		const now = window.moment();

		// Sort backups by date (newest first)
		const backupsWithDates = backupPaths
			.map((fullPath) => {
				const fileName = fullPath.split("/").pop();
				if (!fileName) return null;

				// Match: backup-YYYY-MM-DD(-optionalSchema).json
				const match = fileName.match(
					/^backup-(\d{4}-\d{2}-\d{2})(?:-[\w\d.]+)?\.json$/,
				);
				if (!match) return null;

				const dateStr = match[1];
				const fileDate = window.moment(dateStr, "YYYY-MM-DD", true);

				if (!fileDate.isValid()) {
					console.warn(
						`Skipping file with invalid date: ${fileName}`,
					);
					return null;
				}

				return { fullPath, fileName, fileDate };
			})
			.filter((item) => item !== null)
			.sort((a, b) => b!.fileDate.valueOf() - a!.fileDate.valueOf());

		// Keep only the most recent maxBackups, delete the rest
		for (let i = maxBackups; i < backupsWithDates.length; i++) {
			const backup = backupsWithDates[i];
			if (!backup) continue;

			const fileExists = await this.app.vault.adapter.exists(
				backup.fullPath,
			);
			if (!fileExists) {
				console.warn(`File already missing: ${backup.fullPath}`);
				continue;
			}

			await this.app.vault.adapter.remove(backup.fullPath);
			console.log(`Deleted old backup: ${backup.fileName}`);
		}
	}

	private async migrateDataFromJSON(loadedData: any) {
		const previousStats = migrateDataFromOldFormat(loadedData);
		this.data.stats = previousStats.stats;
		this.data.schema = "0.2";

		if (this.data.stats) {
			await getDB().dailyActivity.bulkAdd(this.data.stats.dailyActivity);
		}
	}

	private async initializeDataFromJSON(loadedData: PluginData) {
		if (loadedData.settings) {
			this.data.settings = {
				...DEFAULT_SETTINGS,
				...loadedData.settings,
			};
		}
		if (loadedData.stats) {
			this.data.stats = loadedData.stats;

			const dailyActivitiesFromJSON =
				this.data.stats?.dailyActivity || [];

			try {
				/** BulkPut updates the records if they already exist! */
				await getDB().dailyActivity.bulkPut(dailyActivitiesFromJSON);
			} catch (error) {
				console.error(
					"Failed loading some data, contact the developer.",
					error,
				);
			}
		}
	}

	public applyColorStyles() {
		const containerStyle = this.app.workspace.containerEl.style;
		let light = undefined;
		let dark = undefined;

		if (this.data.settings?.heatmapConfig?.colors) {
			light = this.data.settings.heatmapConfig.colors?.light;
			dark = this.data.settings.heatmapConfig.colors?.dark;
		}

		if (light && dark) {
			for (let i = 0; i <= 4; i++) {
				const key = i as keyof ColorConfig;
				containerStyle.setProperty(`--light-${i}`, light[key]);
				containerStyle.setProperty(`--dark-${i}`, dark[key]);
			}
		}
	}

	private initializeCommands() {
		this.addRibbonIcon("calendar-days", "Keep the Rhythm", () => {
			activateSidebarView();
		});

		this.addCommand({
			id: "open-keep-the-rhythm",
			name: "Open sidebar view",
			callback: () => {
				activateSidebarView();
			},
		});

		this.addCommand({
			id: "check-ktr-streak",
			name: "Check writing goal from previous days",
			callback: () => {
				checkPreviousStreak();
			},
		});
	}

	private initializeEvents() {
		this.registerEvent(
			this.app.workspace.on("editor-change", (editor, info) => {
				events.handleEditorChange(editor, info, this);
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				if (file instanceof TFile) events.handleFileDelete(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file: TAbstractFile) => {
				if (file instanceof TFile) events.handleFileCreate(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on(
				"rename",
				(file: TAbstractFile, oldPath: string) => {
					if (file instanceof TFile)
						events.handleFileRename(file, oldPath);
				},
			),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file) events.handleFileOpen(file);
			}),
		);
	}

	// #endregion

	// #region Unloading

	async onunload() {
		events.cleanDBTimeout();

		if (this.dayTimer !== null) {
			window.clearTimeout(this.dayTimer);
		}
		if (this.periodicBackfillTimer !== null) {
			window.clearInterval(this.periodicBackfillTimer);
		}

		if (this.JsonDebounceTimeout) {
			clearTimeout(this.JsonDebounceTimeout);
		}
		this.saveDataToJSON();
		this.backupDataToVaultFolder(this.data);

		await getDB().dailyActivity.clear();
	}

	// #endregion

	async onExternalSettingsChange() {
		try {
			const newData = (await this.loadData()) as PluginData;

			if (JSON.stringify(newData) == JSON.stringify(this.data)) {
				return;
			}

			for (const activity of newData.stats?.dailyActivity || []) {
				let existingActivity;

				if (activity.id) {
					existingActivity = await getDB().dailyActivity.get(
						activity.id,
					);
				}

				/** Find any new activity and add it to the db */
				if (
					existingActivity &&
					JSON.stringify(existingActivity) == JSON.stringify(activity)
				) {
					continue;
				} else {
					await getDB().dailyActivity.put(activity);
				}
			}

			/** Assign new external settings*/
			if (this.data.settings !== newData.settings) {
				this.data.settings = {
					...DEFAULT_SETTINGS,
					...newData.settings,
				};
				this.startPeriodicBackfill();
			}

			state.emit(EVENTS.REFRESH_EVERYTHING);
			//TODO: ADD "SAVE AND UPDATE" HERE + EMIT UPDATE TO PLUGIN STATE
		} catch (error) {
			console.error("Error in onExternalSettingsChange:", error);
		}
	}

	// #region SAVING DATA

	public async saveDataToJSON() {
		const dailyActivityDB = await getDB().dailyActivity.toArray();

		this.data.stats = {
			...this.data.stats,
			dailyActivity: dailyActivityDB,
		};

		await this.saveData(this.data);
	}

	public async updateCurrentStreak(increase: boolean) {
		if (!this.data.stats) return;

		// TODO: check previous date to see when was the last one

		if (!this.data.stats.daysWithCompletedGoal) {
			this.data.stats.daysWithCompletedGoal = [];
		}

		const { longestStreak, currentStreak } = utils.getDateStreaks(
			this.data.stats.daysWithCompletedGoal,
		);

		if (increase) {
			if (this.data.stats.daysWithCompletedGoal.includes(state.today)) {
				return;
			}
			this.data.stats.daysWithCompletedGoal.push(state.today);
		} else {
			if (this.data.stats.daysWithCompletedGoal.includes(state.today)) {
				const newArray = this.data.stats.daysWithCompletedGoal?.filter(
					(item) => item !== state.today,
				);
				this.data.stats.daysWithCompletedGoal = newArray;
			}
		}
		this.quietSave();
	}

	public async updateAndSaveEverything() {
		await this.saveData(this.data);
		this.startPeriodicBackfill();
		state.setToday(); // already refreshes everything
	}

	public async quietSave() {
		await this.saveData(this.data);
	}

	// #endregion
}
