import { DailyActivity, TimeEntry } from "@/db/types";

export function isLikelyLegacyCumulativeActivity(
	activity: DailyActivity,
): boolean {
	const positiveChanges = activity.changes.filter(
		(entry) => entry.w > 0 || entry.c > 0,
	);

	if (positiveChanges.length < 2) {
		return false;
	}

	let monotonic = true;
	for (let i = 1; i < positiveChanges.length; i++) {
		if (
			positiveChanges[i].w < positiveChanges[i - 1].w ||
			positiveChanges[i].c < positiveChanges[i - 1].c
		) {
			monotonic = false;
			break;
		}
	}

	if (!monotonic) {
		return false;
	}

	const wordSum = positiveChanges.reduce((sum, entry) => sum + entry.w, 0);
	const charSum = positiveChanges.reduce((sum, entry) => sum + entry.c, 0);
	const maxWord = positiveChanges[positiveChanges.length - 1].w;
	const maxChar = positiveChanges[positiveChanges.length - 1].c;

	return wordSum > maxWord * 1.5 || charSum > maxChar * 1.5;
}

export function normalizeLegacyCumulativeChanges(
	changes: TimeEntry[],
): TimeEntry[] {
	let previousWordTotal = 0;
	let previousCharTotal = 0;

	return changes.map((entry) => {
		const normalizedEntry: TimeEntry = {
			timeKey: entry.timeKey,
			w: Math.max(0, entry.w - previousWordTotal),
			c: Math.max(0, entry.c - previousCharTotal),
		};

		previousWordTotal = Math.max(previousWordTotal, entry.w);
		previousCharTotal = Math.max(previousCharTotal, entry.c);

		return normalizedEntry;
	});
}

export function repairLegacyCumulativeActivity(
	activity: DailyActivity,
): DailyActivity {
	if (!isLikelyLegacyCumulativeActivity(activity)) {
		return activity;
	}

	return {
		...activity,
		changes: normalizeLegacyCumulativeChanges(activity.changes),
	};
}

export function repairLegacyCumulativeActivities(
	activities: DailyActivity[],
): { activities: DailyActivity[]; repairedCount: number } {
	let repairedCount = 0;

	const repairedActivities = activities.map((activity) => {
		const repaired = repairLegacyCumulativeActivity(activity);
		if (repaired !== activity) {
			repairedCount++;
		}
		return repaired;
	});

	return { activities: repairedActivities, repairedCount };
}
