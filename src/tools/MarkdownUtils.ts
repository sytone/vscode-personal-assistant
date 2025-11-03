/**
 * Utilities for parsing and manipulating markdown with YAML frontmatter using remark.
 * This module provides a modern alternative to gray-matter using the unified/remark ecosystem.
 * 
 * @remarks
 * This module uses dynamic imports for ESM compatibility with VSCode's CommonJS requirement.
 * All exported functions are async due to dynamic imports.
 */

import type { Root, Yaml } from 'mdast';
import type { Node } from 'unist';

/**
 * Parsed markdown result containing frontmatter and content.
 */
export interface ParsedMarkdown {
	/** Parsed frontmatter data as key-value pairs. Empty object if no frontmatter. */
	data: Record<string, any>;
	/** Markdown content without frontmatter. */
	content: string;
	/** Original raw markdown including frontmatter. */
	raw: string;
}

/**
 * Cached imports for ESM modules.
 * These are loaded dynamically on first use to support CommonJS/ESM interop.
 */
let remarkModules: {
	unified: any;
	remarkParse: any;
	remarkStringify: any;
	remarkFrontmatter: any;
	visit: any;
	YAML: any;
} | null = null;

/**
 * Lazily loads and caches ESM modules using dynamic imports.
 * This enables CommonJS code (VSCode extensions) to use ESM-only packages.
 * 
 * @returns Promise resolving to cached module references
 */
async function loadRemarkModules() {
	if (remarkModules) {
		return remarkModules;
	}

	const [unified, remarkParse, remarkStringify, remarkFrontmatter, unistUtilVisit, yaml] = await Promise.all([
		import('unified'),
		import('remark-parse'),
		import('remark-stringify'),
		import('remark-frontmatter'),
		import('unist-util-visit'),
		import('yaml'),
	]);

	remarkModules = {
		unified: unified.unified,
		remarkParse: remarkParse.default,
		remarkStringify: remarkStringify.default,
		remarkFrontmatter: remarkFrontmatter.default,
		visit: unistUtilVisit.visit,
		YAML: yaml,
	};

	return remarkModules;
}

/**
 * Parses markdown content to extract YAML frontmatter and body content.
 * Uses the remark ecosystem for standards-compliant parsing.
 *
 * @param markdown - The raw markdown string to parse
 * @returns Promise resolving to parsed result with frontmatter data and content
 *
 * @remarks
 * This function:
 * - Parses YAML frontmatter (enclosed in `---`)
 * - Extracts frontmatter as a JavaScript object
 * - Returns body content separate from frontmatter
 * - Returns empty object for data if no frontmatter exists
 * - Uses dynamic imports for ESM compatibility
 *
 * @example
 * ```typescript
 * const result = await parseMarkdown(`---
 * title: My Note
 * tag: project
 * ---
 * # Content here`);
 * // result.data => { title: 'My Note', tag: 'project' }
 * // result.content => '# Content here'
 * ```
 */
export async function parseMarkdown(markdown: string): Promise<ParsedMarkdown> {
	const modules = await loadRemarkModules();
	let frontmatterData: Record<string, any> = {};
	let contentWithoutFrontmatter = markdown;

	// Parse the markdown with remark
	const tree = modules.unified()
		.use(modules.remarkParse)
		.use(modules.remarkFrontmatter, ['yaml'])
		.parse(markdown) as Root;

	// Extract frontmatter
	modules.visit(tree, 'yaml', (node: Yaml) => {
		try {
			frontmatterData = modules.YAML.parse(node.value) || {};
		} catch (err) {
			// If YAML parsing fails, leave frontmatterData as empty object
			console.warn('Failed to parse YAML frontmatter:', err);
		}
	});

	// Remove frontmatter nodes from tree to get content
	tree.children = tree.children.filter(
		(child: Node) => child.type !== 'yaml' && child.type !== 'toml'
	);

	// Convert tree back to markdown string
	const processor = modules.unified().use(modules.remarkStringify, {
		bullet: '*',
		fence: '`',
		fences: true,
		incrementListMarker: false,
	});

	contentWithoutFrontmatter = processor.stringify(tree).trim();

	return {
		data: frontmatterData,
		content: contentWithoutFrontmatter,
		raw: markdown,
	};
}

/**
 * Stringifies markdown content with optional YAML frontmatter.
 * Creates a properly formatted markdown file with frontmatter block.
 *
 * @param content - The markdown body content
 * @param frontmatter - Optional frontmatter data to include
 * @returns Promise resolving to complete markdown string with frontmatter (if provided)
 *
 * @remarks
 * This function:
 * - Creates YAML frontmatter block if data provided
 * - Ensures proper formatting with `---` delimiters
 * - Handles empty or undefined frontmatter gracefully
 * - Preserves content formatting
 * - Uses dynamic imports for ESM compatibility
 *
 * @example
 * ```typescript
 * const markdown = await stringifyMarkdown(
 *   '# My Note\n\nContent here',
 *   { title: 'My Note', tag: 'project' }
 * );
 * // Returns:
 * // ---
 * // title: My Note
 * // tag: project
 * // ---
 * //
 * // # My Note
 * //
 * // Content here
 * ```
 */
export async function stringifyMarkdown(
	content: string,
	frontmatter?: Record<string, any>
): Promise<string> {
	if (!frontmatter || Object.keys(frontmatter).length === 0) {
		return content;
	}

	const modules = await loadRemarkModules();
	const yamlString = modules.YAML.stringify(frontmatter).trim();
	return `---\n${yamlString}\n---\n\n${content}`;
}

/**
 * Updates specific frontmatter fields while preserving others.
 * Provides a convenient way to modify frontmatter without manual parsing/stringifying.
 *
 * @param markdown - The original markdown with frontmatter
 * @param updates - Key-value pairs to update in frontmatter
 * @returns Promise resolving to updated markdown with modified frontmatter
 *
 * @remarks
 * This function:
 * - Preserves existing frontmatter fields not in updates
 * - Adds new fields if they don't exist
 * - Updates existing fields with new values
 * - Maintains content unchanged
 * - Creates frontmatter section if none exists
 *
 * @example
 * ```typescript
 * const original = `---
 * title: Old
 * tag: project
 * ---
 * Content`;
 *
 * const updated = await updateFrontmatter(original, { title: 'New', status: 'done' });
 * // Frontmatter now has: { title: 'New', tag: 'project', status: 'done' }
 * ```
 */
export async function updateFrontmatter(
	markdown: string,
	updates: Record<string, any>
): Promise<string> {
	const parsed = await parseMarkdown(markdown);
	const newFrontmatter = { ...parsed.data, ...updates };
	return stringifyMarkdown(parsed.content, newFrontmatter);
}

/**
 * Removes specific keys from frontmatter.
 * Useful for cleaning up obsolete metadata fields.
 *
 * @param markdown - The original markdown with frontmatter
 * @param keys - Array of keys to remove from frontmatter
 * @returns Promise resolving to updated markdown with specified keys removed
 *
 * @remarks
 * This function:
 * - Removes only specified keys
 * - Preserves all other frontmatter fields
 * - Maintains content unchanged
 * - Handles non-existent keys gracefully
 *
 * @example
 * ```typescript
 * const original = `---
 * title: Note
 * draft: true
 * tag: project
 * ---
 * Content`;
 *
 * const updated = await removeFrontmatterKeys(original, ['draft']);
 * // Frontmatter now has: { title: 'Note', tag: 'project' }
 * ```
 */
export async function removeFrontmatterKeys(
	markdown: string,
	keys: string[]
): Promise<string> {
	const parsed = await parseMarkdown(markdown);
	const newFrontmatter = { ...parsed.data };

	for (const key of keys) {
		delete newFrontmatter[key];
	}

	return stringifyMarkdown(parsed.content, newFrontmatter);
}

/**
 * Extracts just the content without frontmatter.
 * Convenient shorthand for getting only the markdown body.
 *
 * @param markdown - The markdown with optional frontmatter
 * @returns Promise resolving to just the content portion
 *
 * @example
 * ```typescript
 * const content = await getContent(`---
 * title: Note
 * ---
 * # Heading`);
 * // Returns: '# Heading'
 * ```
 */
export async function getContent(markdown: string): Promise<string> {
	const parsed = await parseMarkdown(markdown);
	return parsed.content;
}

/**
 * Extracts just the frontmatter data.
 * Convenient shorthand for getting only metadata.
 *
 * @param markdown - The markdown with optional frontmatter
 * @returns Promise resolving to the frontmatter data object
 *
 * @example
 * ```typescript
 * const data = await getFrontmatter(`---
 * title: Note
 * tag: project
 * ---
 * Content`);
 * // Returns: { title: 'Note', tag: 'project' }
 * ```
 */
export async function getFrontmatter(markdown: string): Promise<Record<string, any>> {
	const parsed = await parseMarkdown(markdown);
	return parsed.data;
}
