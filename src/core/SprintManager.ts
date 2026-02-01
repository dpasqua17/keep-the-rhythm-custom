import { state } from "./pluginState";
import { exec, ChildProcess } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type SprintStatus = "idle" | "working" | "break" | "paused";

interface SprintStats {
	wordsAtStart: number;
	wordsWritten: number;
	startTime: Date;
}

export const SPRINT_VIDEOS = [
	"V-FO9ST7KUI",
	"jfKfPfyJRdk",
	"n61ULEU7Kb0",
	"MYPVQccHh8g",
	"lP26UCnoH9s",
];

export class SprintManager {
	private status: SprintStatus = "idle";
	private workDuration: number = 25; // minutes
	private breakDuration: number = 5; // minutes
	private timeRemaining: number = 0; // seconds
	private timerInterval: NodeJS.Timeout | null = null;
	private currentVideoIndex: number = 0;
	private browserProcess: ChildProcess | null = null;
	private stats: SprintStats | null = null;
	private onUpdate: (
		status: SprintStatus,
		timeRemaining: number,
		stats: SprintStats | null,
	) => void;
	private fadeDuration: number = 2; // seconds

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

		await this.spawnBrowser();
		await this.fadeAudio("in");
		this.startTimer();
		this.notifyUpdate();
	}

	pauseSprint(): void {
		if (this.status !== "working" && this.status !== "break") return;

		this.status = "paused";
		this.stopTimer();
		this.fadeAudio("out");
		this.notifyUpdate();
	}

	private resumeSprint(): void {
		this.status =
			this.timeRemaining > this.breakDuration * 60 ? "working" : "break";
		this.startTimer();
		this.fadeAudio("in");
		this.notifyUpdate();
	}

	async endSprint(): Promise<void> {
		this.stopTimer();
		await this.fadeAudio("out");
		this.status = "idle";
		this.timeRemaining = this.workDuration * 60;
		this.stats = null;
		this.notifyUpdate();
	}

	async nextVideo(): Promise<void> {
		this.currentVideoIndex =
			(this.currentVideoIndex + 1) % SPRINT_VIDEOS.length;
		if (this.browserProcess) {
			await this.killBrowser();
			await this.spawnBrowser();
		}
	}

	async cycleToBreak(): Promise<void> {
		if (this.status !== "working") return;

		this.stopTimer();
		this.status = "break";
		this.timeRemaining = this.breakDuration * 60;
		await this.fadeAudio("in");
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

	private async spawnBrowser(): Promise<void> {
		const videoId = SPRINT_VIDEOS[this.currentVideoIndex];
		const url = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}`;

		try {
			this.browserProcess = exec(
				`chromium --new-window --app="${url}"`,
				(error) => {
					if (error && !error.message.includes("SIGTERM")) {
						console.error("Failed to spawn Chromium:", error);
					}
				},
			);
		} catch (error) {
			console.error("Error spawning browser:", error);
		}
	}

	async killBrowser(): Promise<void> {
		if (this.browserProcess) {
			this.browserProcess.kill();
			this.browserProcess = null;
		}

		try {
			await execAsync("pkill -f 'chromium.*youtube.com/embed'");
		} catch (error) {
			// Process might not exist, that's fine
		}
	}

	private async fadeAudio(direction: "in" | "out"): Promise<void> {
		const steps = 10;
		const stepDuration = (this.fadeDuration * 1000) / steps;
		const targetVolume = direction === "in" ? 100 : 0;
		const startVolume = direction === "in" ? 0 : 100;

		for (let i = 0; i <= steps; i++) {
			const volume =
				startVolume + ((targetVolume - startVolume) * i) / steps;
			await this.setChromiumVolume(volume);
			await new Promise((resolve) => setTimeout(resolve, stepDuration));
		}
	}

	private async setChromiumVolume(volumePercent: number): Promise<void> {
		try {
			const { stdout } = await execAsync("pactl list sink-inputs");
			const chromiumSink = stdout
				.split("Sink Input #")
				.find(
					(sink) =>
						sink.includes("chromium") || sink.includes("Chromium"),
				);

			if (chromiumSink) {
				const sinkId = chromiumSink.match(/(\d+)/)?.[0];
				if (sinkId) {
					const volume = Math.round((volumePercent / 100) * 65536);
					await execAsync(
						`pactl set-sink-input-volume ${sinkId} ${volume}`,
					);
				}
			}
		} catch (error) {
			// Silently fail if pactl not available
		}
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

	getCurrentVideoIndex(): number {
		return this.currentVideoIndex;
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

	static async killAllBrowsers(): Promise<void> {
		try {
			await execAsync("pkill -f 'chromium.*youtube.com/embed'");
		} catch (error) {
			// Process might not exist, that's fine
		}
	}
}
