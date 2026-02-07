import {
	areCountsAlreadyTracked,
	chooseBackfillBaseline,
	clampBackfillIntervalMinutes,
	computeCompletedDatesFromDeltas,
	resolveBackfillDate,
} from "@/core/backfillLogic";

describe("backfillLogic", () => {
	test("clamps backfill interval to allowed bounds", () => {
		expect(clampBackfillIntervalMinutes(undefined, 60, 5, 1440)).toBe(60);
		expect(clampBackfillIntervalMinutes(2, 60, 5, 1440)).toBe(5);
		expect(clampBackfillIntervalMinutes(5000, 60, 5, 1440)).toBe(1440);
		expect(clampBackfillIntervalMinutes(45.9, 60, 5, 1440)).toBe(45);
	});

	test("skips when latest tracked counts match current counts", () => {
		const latest = {
			date: "2026-02-07",
			totalWords: 1200,
			totalChars: 6500,
		};

		expect(areCountsAlreadyTracked(1200, 6500, latest, undefined)).toBe(true);
		expect(areCountsAlreadyTracked(1201, 6500, latest, undefined)).toBe(false);
	});

	test("prefers newer snapshot over older latest activity when choosing baseline", () => {
		const latest = {
			date: "2026-02-01",
			totalWords: 1000,
			totalChars: 5000,
		};
		const snapshot = {
			wordCount: 1100,
			charCount: 5500,
			lastModified: new Date("2026-02-02T12:00:00").getTime(),
		};

		const baseline = chooseBackfillBaseline(
			latest,
			snapshot,
			new Date("2026-02-03T12:00:00").getTime(),
		);

		expect(baseline).toEqual({
			wordCount: 1100,
			charCount: 5500,
			date: "2026-02-02",
		});
	});

	test("uses latest activity when snapshot is older", () => {
		const latest = {
			date: "2026-02-05",
			totalWords: 1300,
			totalChars: 7000,
		};
		const snapshot = {
			wordCount: 1200,
			charCount: 6400,
			lastModified: new Date("2026-02-05T00:30:00").getTime(),
		};

		const baseline = chooseBackfillBaseline(
			latest,
			snapshot,
			new Date("2026-02-06T12:00:00").getTime(),
		);

		expect(baseline).toEqual({
			wordCount: 1300,
			charCount: 7000,
			date: "2026-02-05",
		});
	});

	test("computes completed goal dates from per-day deltas", () => {
		const deltas = [
			{ date: "2026-02-01", wordDelta: 200 },
			{ date: "2026-02-01", wordDelta: 400 },
			{ date: "2026-02-02", wordDelta: 100 },
			{ date: "2026-02-03", wordDelta: 700 },
		];

		expect(computeCompletedDatesFromDeltas(deltas, 500)).toEqual([
			"2026-02-01",
			"2026-02-03",
		]);
	});

	test("backfill date never goes before baseline date", () => {
		expect(resolveBackfillDate("2026-02-04", "2026-02-03")).toBe("2026-02-04");
		expect(resolveBackfillDate("2026-02-01", "2026-02-03")).toBe("2026-02-03");
	});
});
