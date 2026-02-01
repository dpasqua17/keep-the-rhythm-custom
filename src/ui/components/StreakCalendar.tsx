import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { moment as _moment } from "obsidian";
import { formatDate } from "@/utils/dateUtils";
import { getDateStreaks, getDateForCell, sumTimeEntries } from "@/utils/utils";
import { getDB } from "@/db/db";
import { DailyActivity } from "@/db/types";
import { Unit } from "@/defs/types";

const moment = _moment as unknown as typeof _moment.default;

interface StreakCalendarProps {
	dailyGoal: number;
}

export const StreakCalendar: React.FC<StreakCalendarProps> = ({
	dailyGoal,
}) => {
	const weeksToShow = 6;

	const calendarData = useLiveQuery(async () => {
		// Get last 6 weeks of activity
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - weeksToShow * 7);

		const activities = await getDB()
			.dailyActivity.where("date")
			.between(formatDate(startDate), formatDate(endDate))
			.toArray();

		// Calculate word counts per day
		const dayData: Record<string, { count: number; metGoal: boolean }> = {};

		for (const activity of activities) {
			const wordCount = sumTimeEntries(activity, Unit.WORD, true);
			if (dayData[activity.date]) {
				dayData[activity.date].count += wordCount;
			} else {
				dayData[activity.date] = {
					count: wordCount,
					metGoal: false,
				};
			}
		}

		// Mark days that met goal
		for (const date in dayData) {
			dayData[date].metGoal = dayData[date].count >= dailyGoal;
		}

		// Get streak info
		const goalMetDates = Object.entries(dayData)
			.filter(([_, data]) => data.metGoal)
			.map(([date]) => date);

		const { currentStreak, longestStreak } = getDateStreaks(goalMetDates);

		return { dayData, currentStreak, longestStreak };
	}, [dailyGoal]);

	if (!calendarData) {
		return <div className="streak-calendar-loading">Loading...</div>;
	}

	const { dayData, currentStreak, longestStreak } = calendarData;

	const getDayStatus = (dateStr: string): "met" | "missed" | "empty" => {
		if (!dayData[dateStr]) return "empty";
		return dayData[dateStr].metGoal ? "met" : "missed";
	};

	const getTooltipText = (dateStr: string): string => {
		if (!dayData[dateStr]) return `${dateStr}: No activity`;
		const { count, metGoal } = dayData[dateStr];
		return `${dateStr}: ${count} words${metGoal ? " ✓ Goal met!" : ""}`;
	};

	return (
		<div className="streak-calendar">
			<div className="streak-header">
				<span className="streak-title">Writing Streaks</span>
				<div className="streak-stats">
					<span className="streak-current" title="Current streak">
						🔥 {currentStreak}
					</span>
					<span className="streak-longest" title="Longest streak">
						⭐ {longestStreak}
					</span>
				</div>
			</div>

			<div className="streak-grid">
				{Array(weeksToShow)
					.fill(null)
					.map((_, weekIndex) => (
						<div key={weekIndex} className="streak-week">
							{Array(7)
								.fill(null)
								.map((_, dayIndex) => {
									const date = getDateForCell(
										weekIndex,
										dayIndex,
										weeksToShow,
									);
									const dateStr = formatDate(date);
									const status = getDayStatus(dateStr);

									return (
										<div
											key={dateStr}
											className={`streak-day streak-${status}`}
											title={getTooltipText(dateStr)}
										>
											<span className="streak-day-number">
												{date.getDate()}
											</span>
										</div>
									);
								})}
						</div>
					))}
			</div>

			<div className="streak-legend">
				<span className="legend-item">
					<span className="legend-dot streak-met"></span> Met goal
				</span>
				<span className="legend-item">
					<span className="legend-dot streak-missed"></span> Missed
				</span>
				<span className="legend-item">
					<span className="legend-dot streak-empty"></span> No data
				</span>
			</div>
		</div>
	);
};
