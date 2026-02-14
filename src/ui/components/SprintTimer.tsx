import React, { useState, useEffect, useCallback } from "react";
import { SprintManager, SprintStatus } from "@/core/SprintManager";

interface SprintTimerProps {
	workDuration: number;
	breakDuration: number;
}

export const SprintTimer: React.FC<SprintTimerProps> = ({
	workDuration,
	breakDuration,
}) => {
	const [manager] = useState(
		() => new SprintManager(() => {}, workDuration, breakDuration),
	);
	const [status, setStatus] = useState<SprintStatus>("idle");
	const [timeRemaining, setTimeRemaining] = useState(workDuration * 60);
	const [wordsWritten, setWordsWritten] = useState(0);

	useEffect(() => {
		manager.setDurations(workDuration, breakDuration);
	}, [manager, workDuration, breakDuration]);

	const updateState = useCallback(() => {
		setStatus(manager.getStatus());
		setTimeRemaining(manager.getTimeRemaining());
		const stats = manager.getStats();
		if (stats) {
			setWordsWritten(stats.wordsWritten);
		}
	}, [manager]);

	useEffect(() => {
		const interval = setInterval(updateState, 1000);
		return () => clearInterval(interval);
	}, [updateState]);

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	const handleStart = async () => {
		await manager.startSprint();
		updateState();
	};

	const handlePause = () => {
		manager.pauseSprint();
		updateState();
	};

	const handleReset = async () => {
		await manager.endSprint();
		updateState();
		setWordsWritten(0);
	};

	const getStatusText = (): string => {
		switch (status) {
			case "idle":
				return "Ready";
			case "working":
				return "Work Sprint";
			case "break":
				return "Break";
			case "paused":
				return "Paused";
			default:
				return "";
		}
	};

	const getStatusClass = (): string => {
		return `sprint-status-${status}`;
	};

	return (
		<div className="sprint-timer">
			<div className="sprint-header">
				<span className="sprint-title">Writing Sprint</span>
				<span className={`sprint-status ${getStatusClass()}`}>
					{getStatusText()}
				</span>
			</div>

			<div className="sprint-time-display">
				<span className="sprint-time">{formatTime(timeRemaining)}</span>
			</div>

			<div className="sprint-stats">
				<span className="sprint-words">
					{wordsWritten > 0
						? `${wordsWritten} words`
						: "Start writing..."}
				</span>
			</div>

			<div className="sprint-controls">
				{status === "idle" ? (
					<button
						className="sprint-btn sprint-btn-primary"
						onClick={handleStart}
						title="Start sprint"
					>
						▶️ Start
					</button>
				) : status === "paused" ? (
					<button
						className="sprint-btn sprint-btn-primary"
						onClick={handleStart}
						title="Resume sprint"
					>
						▶️ Resume
					</button>
				) : (
					<button
						className="sprint-btn sprint-btn-secondary"
						onClick={handlePause}
						title="Pause sprint"
					>
						⏸️ Pause
					</button>
				)}

				<button
					className="sprint-btn sprint-btn-secondary"
					onClick={handleReset}
					title="End sprint"
					disabled={status === "idle"}
				>
					⏹️ Stop
				</button>
			</div>

			<div className="sprint-info">
				<span className="sprint-config">
					{workDuration}m work / {breakDuration}m break
				</span>
			</div>
		</div>
	);
};
