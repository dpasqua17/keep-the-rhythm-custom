import type { CachedMetadata, MetadataCache, TFile, Vault } from "obsidian";

/**
 * Returns true when no filter is configured or the content has the configured tag
 * either inline (`#tag`) or in frontmatter (`tags:`).
 */
export function contentHasTag(content: string, tagFilter: string): boolean {
	const normalizedFilter = normalizeTag(tagFilter);
	if (!normalizedFilter) {
		return true;
	}

	const inlineTagRegex = /(^|[\s.,;:!?()[\]{}"'`~])#([^\s#]+)/g;
	let match: RegExpExecArray | null;
	while ((match = inlineTagRegex.exec(content)) !== null) {
		const inlineTag = match[2];
		if (matchesTagFilter(inlineTag, normalizedFilter)) {
			return true;
		}
	}

	// YAML frontmatter check
	const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return false;
	}

	const frontmatter = frontmatterMatch[1];
	const tags = extractTagsFromFrontmatterString(frontmatter);
	return tags.some((tag) => matchesTagFilter(tag, normalizedFilter));
}

export function fileHasTagFromCache(
	file: TFile,
	tagFilter: string,
	metadataCache: MetadataCache,
): boolean | null {
	const normalizedFilter = normalizeTag(tagFilter);
	if (!normalizedFilter) return true;

	const cache = metadataCache.getFileCache(file);
	if (!cache) return null;

	const tags = extractTagsFromCache(cache);
	return tags.some((tag) => matchesTagFilter(tag, normalizedFilter));
}

export async function fileHasTag(
	file: TFile,
	tagFilter: string,
	vault: Vault,
	metadataCache?: MetadataCache,
): Promise<boolean> {
	const normalizedFilter = normalizeTag(tagFilter);
	if (!normalizedFilter) {
		return true;
	}

	if (metadataCache) {
		const cachedResult = fileHasTagFromCache(
			file,
			normalizedFilter,
			metadataCache,
		);
		if (cachedResult !== null) {
			return cachedResult;
		}
	}

	try {
		const content = await vault.read(file);
		return contentHasTag(content, normalizedFilter);
	} catch (error) {
		console.error(`KTR: Error checking tags for ${file.path}:`, error);
		return false;
	}
}

function extractTagsFromCache(cache: CachedMetadata): string[] {
	const tags: string[] = [];

	for (const tag of cache.tags || []) {
		tags.push(tag.tag);
	}

	const frontmatterTags = extractTagsFromFrontmatterObject(cache.frontmatter);
	tags.push(...frontmatterTags);

	return tags;
}

function extractTagsFromFrontmatterObject(frontmatter: any): string[] {
	if (!frontmatter || !("tags" in frontmatter)) return [];

	const rawTags = frontmatter.tags;
	if (Array.isArray(rawTags)) {
		return rawTags.map((tag) => String(tag));
	}
	if (typeof rawTags === "string") {
		return rawTags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
	}

	return [];
}

function extractTagsFromFrontmatterString(frontmatter: string): string[] {
	const tags: string[] = [];

	const listBlockMatch = frontmatter.match(
		/^tags:\s*\n((?:\s*-\s*[^\n]+\n?)*)/m,
	);
	if (listBlockMatch && listBlockMatch[1]) {
		for (const line of listBlockMatch[1].split("\n")) {
			const itemMatch = line.match(/^\s*-\s*(.+)\s*$/);
			if (itemMatch) {
				tags.push(itemMatch[1]);
			}
		}
	}

	const inlineArrayMatch = frontmatter.match(/^tags:\s*\[([^\]]*)\]/m);
	if (inlineArrayMatch && inlineArrayMatch[1]) {
		tags.push(
			...inlineArrayMatch[1]
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		);
	}

	const singleLineMatch = frontmatter.match(/^tags:\s*([^\n\[]+)\s*$/m);
	if (singleLineMatch && singleLineMatch[1]) {
		tags.push(
			...singleLineMatch[1]
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		);
	}

	return tags;
}

function matchesTagFilter(tagCandidate: string, normalizedFilter: string): boolean {
	const normalizedCandidate = normalizeTag(tagCandidate);
	if (!normalizedCandidate) return false;

	return (
		normalizedCandidate === normalizedFilter ||
		normalizedCandidate.startsWith(`${normalizedFilter}/`)
	);
}

function normalizeTag(tagValue: string): string {
	const trimmed = (tagValue || "").trim().toLowerCase();
	if (!trimmed) return "";

	return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}
