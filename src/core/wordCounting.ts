import { Language } from "@/defs/types";

export function getWordCount(text: string, regex: RegExp): number {
	if (!text?.trim()) return 0;

	// Simple word count: split by whitespace, filter empty strings
	const words = text.split(/\s+/).filter((w) => w.length > 0);
	return words.length;
}

export function createRegex(langs: Language[]): RegExp {
	return /\s+/g; // Not used with simple split
}

export function getLanguageBasedWordCount(
	text: string,
	enabledLanguages: Language[],
) {
	// Simple word count - split by whitespace
	return getWordCount(text, /\s+/g);
}
