/**
 * Parameter interfaces for note management operations.
 * These types are platform-agnostic and used by both the core implementation
 * and platform-specific adapters (VS Code, MCP server).
 */

/** Parameters for listing markdown files in the vault. */
export interface IListFilesParameters {
	/** Optional folder path relative to vault root to filter results. */
	folderPath?: string;
	/** Whether to include content previews for each file (default: false for efficiency). */
	includeContent?: boolean;
}

/** Parameters for searching files by filename pattern. */
export interface ISearchFilesByNameParameters {
	/** Filename pattern to search for (case-insensitive substring match). */
	namePattern: string;
	/** Whether to include content previews for matching files (default: false). */
	includeContent?: boolean;
}

/** Parameters for searching files by content text. */
export interface ISearchFilesByContentParameters {
	/** Text to search for within file contents (case-insensitive). */
	searchText: string;
	/** Whether to include full content for matching files (default: false). */
	includeContent?: boolean;
}

/** Parameters for searching notes by YAML frontmatter metadata. */
export interface ISearchNotesByFrontmatterParameters {
	/** Frontmatter key to search for (e.g., 'tag', 'status'). */
	key: string;
	/** Optional value for exact match. If omitted, searches for key existence. */
	value?: string;
	/** Whether to include content previews for matching notes (default: false). */
	includeContent?: boolean;
}

/** Parameters for reading a specific note. */
export interface IReadNoteParameters {
	/** Path to the note relative to vault root. */
	notePath: string;
}

/** Parameters for creating a new note. */
export interface ICreateNoteParameters {
	/** Path for the new note relative to vault root. */
	notePath: string;
	/** Markdown content of the note (without frontmatter). */
	content: string;
	/** Optional YAML frontmatter as key-value pairs. */
	frontmatter?: Record<string, any>;
	/** Optional template identifier to seed the note content. */
	templateName?: string;
	/** Optional data passed to the template renderer. */
	templateData?: Record<string, unknown>;
}

/** Parameters for updating note content. */
export interface IUpdateNoteParameters {
	/** Path to the note relative to vault root. */
	notePath: string;
	/** New markdown content (frontmatter preserved automatically). */
	content: string;
}

/** Frontmatter operation for atomic updates. */
export interface IFrontmatterOperation {
	/** Operation type: 'set' to add/update, 'delete' to remove. */
	action: 'set' | 'delete';
	/** Frontmatter key to operate on. */
	key: string;
	/** Value to set (required for 'set', ignored for 'delete'). */
	value?: any;
}

/** Parameters for updating note frontmatter metadata. */
export interface IUpdateNoteFrontmatterParameters {
	/** Path to the note relative to vault root. */
	notePath: string;
	/** Array of operations to perform on frontmatter (set or delete keys). */
	operations: IFrontmatterOperation[];
}

/** Parameters for deleting a note. */
export interface IDeleteNoteParameters {
	/** Path to the note to delete relative to vault root. */
	notePath: string;
}
