import { TimeEntry } from "@/db/types";

export interface BucketDeltas {
	wordDelta: number;
	charDelta: number;
}

export function getTrackedTotalsExcludingTimeKey(
	changes: TimeEntry[],
	timeKey: string,
): BucketDeltas {
	let wordDelta = 0;
	let charDelta = 0;

	for (const entry of changes) {
		if (entry.timeKey === timeKey) continue;
		wordDelta += entry.w;
		charDelta += entry.c;
	}

	return { wordDelta, charDelta };
}

export function getBucketDeltas(
	changes: TimeEntry[],
	timeKey: string,
	totalWordsWritten: number,
	totalCharsWritten: number,
): BucketDeltas {
	const trackedTotals = getTrackedTotalsExcludingTimeKey(changes, timeKey);

	return {
		wordDelta: Math.max(0, totalWordsWritten - trackedTotals.wordDelta),
		charDelta: Math.max(0, totalCharsWritten - trackedTotals.charDelta),
	};
}
