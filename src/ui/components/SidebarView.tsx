import { KeyProvider } from "@/utils/useModiferKey";
import React, { useEffect, useState } from "react";
import type { BackfillStatus, PluginData } from "@/defs/types";
import KeepTheRhythm from "@/main";
import { Heatmap } from "./Heatmap";
import { SlotWrapper } from "./SlotWrapper";
import { EVENTS, state } from "@/core/pluginState";
import { Entries } from "./Entries";
import { StreakCalendar } from "./StreakCalendar";
import { SprintTimer } from "./SprintTimer";

interface KTRView {
	data?: PluginData;
	showSlots?: boolean;
	showHeatmap?: boolean;
	showEntries?: boolean;
	plugin: KeepTheRhythm;
}

export const KTRView = ({ plugin }: KTRView) => {
	const [heatmapConfigState, setHeatmapConfigState] = useState(
		plugin.data.settings.heatmapConfig,
	);

	const [slots, setSlots] = useState(
		plugin.data.settings.sidebarConfig.slots,
	);
	const [showHeatmap, setShowHeatmap] = useState(
		plugin.data.settings.sidebarConfig.visibility.showHeatmap,
	);
	const [showEntries, setShowEntries] = useState(
		plugin.data.settings.sidebarConfig.visibility.showEntries,
	);
	const [showSlots, setShowSlots] = useState(
		plugin.data.settings.sidebarConfig.visibility.showSlots,
	);
	const [sprintConfig, setSprintConfig] = useState(
		plugin.data.settings.sprintConfig,
	);
	const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | undefined>(
		plugin.data.stats?.backfillStatus,
	);

	const updateData = () => {
		setHeatmapConfigState(plugin.data.settings.heatmapConfig);

		setSlots(plugin.data.settings.sidebarConfig.slots);

		setShowHeatmap(
			plugin.data.settings.sidebarConfig.visibility.showHeatmap,
		);
		setShowEntries(
			plugin.data.settings.sidebarConfig.visibility.showEntries,
		);
		setShowSlots(plugin.data.settings.sidebarConfig.visibility.showSlots);
		setSprintConfig(plugin.data.settings.sprintConfig);
		setBackfillStatus(plugin.data.stats?.backfillStatus);
	};

	const lastBackfillText = backfillStatus?.lastRunAt
		? new Date(backfillStatus.lastRunAt).toLocaleString()
		: "Never";

	useEffect(() => {
		updateData();

		state.on(EVENTS.REFRESH_EVERYTHING, updateData);

		return () => {
			state.off(EVENTS.REFRESH_EVERYTHING, updateData);
		};
	}, []);

	return (
		<div
			className={`
			sideBarView 
			`}
		>
				<KeyProvider>
					{showSlots && <SlotWrapper slots={slots} />}
					{showHeatmap && (
						<Heatmap heatmapConfig={heatmapConfigState} query={""} />
					)}
					<StreakCalendar
						dailyGoal={plugin.data.settings.dailyWritingGoal || 500}
					/>
					<div
						className="ktr-backfill-status"
						title="Offline/other-device sync recovery status"
					>
						<div className="ktr-backfill-status__title">Backfill</div>
						<div className="ktr-backfill-status__line">
							Last run: {lastBackfillText}
						</div>
						<div className="ktr-backfill-status__line">
							Tagged: {backfillStatus?.taggedFiles || 0} | Updated:{" "}
							{backfillStatus?.updatedActivities || 0} | Deleted:{" "}
							{backfillStatus?.deletedFilesReconciled || 0}
						</div>
					</div>
					{sprintConfig.enabled && (
						<SprintTimer
							workDuration={sprintConfig.workDuration}
							breakDuration={sprintConfig.breakDuration}
						/>
					)}
				{showEntries && <Entries />}
			</KeyProvider>
		</div>
	);
};
