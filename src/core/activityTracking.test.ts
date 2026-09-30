import { getBucketDeltas } from "@/core/activityTracking";

describe("activityTracking", () => {
	test("stores only the incremental delta for each time bucket", () => {
		const changes = [{ timeKey: "09:00", w: 300, c: 1500 }];

		expect(getBucketDeltas(changes, "09:05", 812, 4000)).toEqual({
			wordDelta: 512,
			charDelta: 2500,
		});
	});

	test("replaces the current bucket with its net contribution", () => {
		const changes = [
			{ timeKey: "09:00", w: 300, c: 1500 },
			{ timeKey: "09:05", w: 200, c: 1000 },
		];

		expect(getBucketDeltas(changes, "09:05", 650, 3200)).toEqual({
			wordDelta: 350,
			charDelta: 1700,
		});
	});

	test("never reports negative deltas when totals fall below prior buckets", () => {
		const changes = [
			{ timeKey: "09:00", w: 300, c: 1500 },
			{ timeKey: "09:05", w: 200, c: 1000 },
		];

		expect(getBucketDeltas(changes, "09:10", 450, 2200)).toEqual({
			wordDelta: 0,
			charDelta: 0,
		});
	});
});
