import {
	isLikelyLegacyCumulativeActivity,
	normalizeLegacyCumulativeChanges,
	repairLegacyCumulativeActivity,
} from "@/core/activityRepair";

describe("activityRepair", () => {
	test("detects legacy cumulative buckets", () => {
		expect(
			isLikelyLegacyCumulativeActivity({
				date: "2026-03-16",
				filePath: "Illness.md",
				wordCountStart: 48,
				charCountStart: 262,
				changes: [
					{ timeKey: "17:45", w: 23, c: 122 },
					{ timeKey: "17:50", w: 269, c: 1494 },
					{ timeKey: "17:55", w: 511, c: 2829 },
					{ timeKey: "18:00", w: 729, c: 4060 },
					{ timeKey: "18:05", w: 771, c: 4291 },
					{ timeKey: "18:20", w: 0, c: 0 },
				],
			}),
		).toBe(true);
	});

	test("normalizes cumulative buckets into true deltas", () => {
		expect(
			normalizeLegacyCumulativeChanges([
				{ timeKey: "17:45", w: 23, c: 122 },
				{ timeKey: "17:50", w: 269, c: 1494 },
				{ timeKey: "17:55", w: 511, c: 2829 },
				{ timeKey: "18:00", w: 729, c: 4060 },
				{ timeKey: "18:05", w: 771, c: 4291 },
				{ timeKey: "18:20", w: 0, c: 0 },
			]),
		).toEqual([
			{ timeKey: "17:45", w: 23, c: 122 },
			{ timeKey: "17:50", w: 246, c: 1372 },
			{ timeKey: "17:55", w: 242, c: 1335 },
			{ timeKey: "18:00", w: 218, c: 1231 },
			{ timeKey: "18:05", w: 42, c: 231 },
			{ timeKey: "18:20", w: 0, c: 0 },
		]);
	});

	test("leaves already-correct delta activities unchanged", () => {
		const activity = {
			date: "2026-03-16",
			filePath: "Draft.md",
			wordCountStart: 0,
			charCountStart: 0,
			changes: [
				{ timeKey: "10:00", w: 120, c: 700 },
				{ timeKey: "10:05", w: 80, c: 460 },
				{ timeKey: "10:10", w: 40, c: 240 },
			],
		};

		expect(repairLegacyCumulativeActivity(activity)).toBe(activity);
	});
});
