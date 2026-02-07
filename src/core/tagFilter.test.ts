import { contentHasTag } from "@/core/tagFilter";

describe("tagFilter", () => {
	test("matches inline tag", () => {
		expect(contentHasTag("hello #writing world", "writing")).toBe(true);
	});

	test("matches nested tag for same base filter", () => {
		expect(contentHasTag("hello #writing/chapter-1", "writing")).toBe(true);
	});

	test("matches frontmatter array tags", () => {
		const content = `---
tags: [writing, fiction]
---
content`;
		expect(contentHasTag(content, "writing")).toBe(true);
	});

	test("matches frontmatter list tags", () => {
		const content = `---
tags:
  - writing
  - fiction
---
content`;
		expect(contentHasTag(content, "writing")).toBe(true);
	});

	test("returns false when tag is not present", () => {
		expect(contentHasTag("hello #journal world", "writing")).toBe(false);
	});
});
