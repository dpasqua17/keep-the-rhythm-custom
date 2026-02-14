import { state } from "./pluginState";

export type SprintStatus = "idle" | "working" | "break" | "paused";

interface SprintStats {
	wordsAtStart: number;
	wordsWritten: number;
	startTime: Date;
}

export class SprintManager {
	private status: SprintStatus = "idle";
	private workDuration: number = 25;
	private breakDuration: number = 5;
	private timeRemaining: number = 0;
	private timerInterval: NodeJS.Timeout | null = null;
	private stats: SprintStats | null = null;
	private onUpdate: (
		status: SprintStatus,
		timeRemaining: number,
		stats: SprintStats | null,
	) => void;

	constructor(
		onUpdate: (
			status: SprintStatus,
			timeRemaining: number,
			stats: SprintStats | null,
		) => void,
		workDuration: number = 25,
		breakDuration: number = 5,
	) {
		this.onUpdate = onUpdate;
		this.workDuration = workDuration;
		this.breakDuration = breakDuration;
		this.timeRemaining = workDuration * 60;
	}

	async startSprint(): Promise<void> {
		if (this.status === "working" || this.status === "break") return;

		if (this.status === "paused") {
			this.resumeSprint();
			return;
		}

		this.status = "working";
		this.timeRemaining = this.workDuration * 60;
		this.stats = {
			wordsAtStart: this.getCurrentWordCount(),
			wordsWritten: 0,
			startTime: new Date(),
		};

		this.startTimer();
		this.notifyUpdate();
	}

	pauseSprint(): void {
		if (this.status !== "working" && this.status !== "break") return;

		this.status = "paused";
		this.stopTimer();
		this.notifyUpdate();
	}

	private resumeSprint(): void {
		this.status =
			this.timeRemaining > this.breakDuration * 60 ? "working" : "break";
		this.startTimer();
		this.notifyUpdate();
	}

	async endSprint(): Promise<void> {
		this.stopTimer();
		this.status = "idle";
		this.timeRemaining = this.workDuration * 60;
		this.stats = null;
		this.notifyUpdate();
	}

	async cycleToBreak(): Promise<void> {
		if (this.status !== "working") return;

		this.stopTimer();
		this.status = "break";
		this.timeRemaining = this.breakDuration * 60;
		this.startTimer();
		this.notifyUpdate();
	}

	private startTimer(): void {
		this.stopTimer();
		this.timerInterval = setInterval(() => {
			this.timeRemaining--;

			if (this.timeRemaining <= 0) {
				if (this.status === "working") {
					this.cycleToBreak();
				} else if (this.status === "break") {
					this.endSprint();
				}
			} else {
				this.updateStats();
				this.notifyUpdate();
			}
		}, 1000);
	}

	private stopTimer(): void {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	private updateStats(): void {
		if (!this.stats) return;

		const currentWords = this.getCurrentWordCount();
		this.stats.wordsWritten = currentWords - this.stats.wordsAtStart;
	}

	private getCurrentWordCount(): number {
		const today = state.today;
		let total = 0;

		if (state.plugin?.data?.stats?.dailyActivity) {
			for (const activity of state.plugin.data.stats.dailyActivity) {
				if (activity.date === today && activity.changes) {
					for (const change of activity.changes) {
						total += change.w || 0;
					}
				}
			}
		}

		return total;
	}

	private notifyUpdate(): void {
		this.onUpdate(this.status, this.timeRemaining, this.stats);
	}

	getStatus(): SprintStatus {
		return this.status;
	}

	getTimeRemaining(): number {
		return this.timeRemaining;
	}

	getStats(): SprintStats | null {
		return this.stats;
	}

	setDurations(work: number, break_: number): void {
		this.workDuration = work;
		this.breakDuration = break_;
		if (this.status === "idle") {
			this.timeRemaining = work * 60;
		}
	}
}
