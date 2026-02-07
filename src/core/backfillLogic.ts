import { FileTrackingSnapshot } from "@/defs/types";

export interface LatestTrackedCounts {
	date: string;
	totalWords: number;
	totalChars: number;
}

export interface BackfillBaseline {
	wordCount: number;
	charCount: number;
	date: string;
}

export interface DailyWordDelta {
	date: string;
	wordDelta: number;
}

export function getActivityEndOfDayTimestamp(date: string): number {
	return new Date(`${date}T23:59:59.999`).getTime();
}

export function resolveBackfillDate(
	mtimeDate: string,
	baselineDate: string,
): string {
	return mtimeDate >= baselineDate ? mtimeDate : baselineDate;
}

export function clampBackfillIntervalMinutes(
	rawValue: number | undefined,
	fallbackMinutes: number,
	minMinutes: number,
	maxMinutes: number,
): number {
	if (!Number.isFinite(rawValue)) {
		return fallbackMinutes;
	}

	return Math.min(
		maxMinutes,
		Math.max(minMinutes, Math.floor(rawValue as number)),
	);
}

export function areCountsAlreadyTracked(
	currentWordCount: number,
	currentCharCount: number,
	latest: LatestTrackedCounts | null,
	snapshot: FileTrackingSnapshot | undefined,
): boolean {
	const latestMatches =
		latest !== null &&
		latest.totalWords === currentWordCount &&
		latest.totalChars === currentCharCount;

	const snapshotMatches =
		!!snapshot &&
		snapshot.wordCount === currentWordCount &&
		snapshot.charCount === currentCharCount;

	return latestMatches || snapshotMatches;
}

export function chooseBackfillBaseline(
	latest: LatestTrackedCounts | null,
	snapshot: FileTrackingSnapshot | undefined,
	safeMtime: number,
): BackfillBaseline | null {
	if (latest && snapshot) {
		const latestActivityEod = getActivityEndOfDayTimestamp(latest.date);
		const snapshotMtime = Math.min(snapshot.lastModified || safeMtime, Date.now());

		if (snapshotMtime > latestActivityEod) {
			return {
				wordCount: snapshot.wordCount,
				charCount: snapshot.charCount,
				date: toDateKey(snapshotMtime),
			};
		}

		return {
			wordCount: latest.totalWords,
			charCount: latest.totalChars,
			date: latest.date,
		};
	}

	if (latest) {
		return {
			wordCount: latest.totalWords,
			charCount: latest.totalChars,
			date: latest.date,
		};
	}

	if (snapshot) {
		const snapshotMtime = Math.min(snapshot.lastModified || safeMtime, Date.now());
		return {
			wordCount: snapshot.wordCount,
			charCount: snapshot.charCount,
			date: toDateKey(snapshotMtime),
		};
	}

	return null;
}

export function computeCompletedDatesFromDeltas(
	deltas: DailyWordDelta[],
	dailyGoal: number,
): string[] {
	const totalsByDate = new Map<string, number>();

	for (const delta of deltas) {
		const currentTotal = totalsByDate.get(delta.date) || 0;
		totalsByDate.set(delta.date, currentTotal + delta.wordDelta);
	}

	return Array.from(totalsByDate.entries())
		.filter(([_, totalWords]) => totalWords >= dailyGoal)
		.map(([date]) => date)
		.sort();
}

function toDateKey(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
