# Personal Assistant for VS Code

A VS Code extension that integrates with Obsidian vaults and GitHub Copilot to provide intelligent tools for managing journals, notes, and personal knowledge. Leverage AI assistance for reading, writing, and organizing your markdown-based knowledge base.

## Features

### 📓 Journal Management
- **Add Journal Entries**: Create timestamped entries in ISO week-formatted journal files (YYYY-Www.md)
- **Read Journal Entries**: Query and retrieve journal entries by date range with AI-powered search
- **Task Tracking**: Add and manage tasks within your weekly journal with markdown checkboxes
- **Weekly Structure**: Automatic organization by ISO week with day-based sections

### 📝 Note Management
- **List Files**: Browse all markdown files in your vault or specific folders
- **Search by Name**: Find notes using filename patterns (case-insensitive)
- **Search by Content**: Full-text search across all notes
- **Frontmatter Search**: Query notes by YAML frontmatter metadata (tags, status, custom fields)
- **CRUD Operations**: Create, read, update, and delete notes with path traversal protection
- **Frontmatter Management**: Update note metadata without modifying content

### 📅 Date Utilities
- **Relative Date Calculation**: Parse natural language dates ("last Wednesday", "two weeks ago")
- **Date Information**: Get day of week, ISO week number, and relative position to today
- **Week Planning**: Retrieve all dates in a week with day names for journal planning

### 🤖 GitHub Copilot Integration
- **Chat Participant**: Use `@journal` in Copilot Chat to interact with your journal
- **Language Model Tools**: All features accessible to AI agents through structured tool APIs
- **Context-Aware**: AI can read your notes and journals to provide informed assistance

## Requirements

- VS Code version 1.105.0 or higher
- GitHub Copilot subscription (for chat participant features)
- An Obsidian vault or markdown-based knowledge base (optional but recommended)

## Extension Settings

This extension contributes the following settings:

* `personal-assistant.vaultPath`: Path to your Obsidian vault root directory. If not set, uses the first workspace folder containing an `.obsidian` folder.
* `personal-assistant.journalFolderName`: Folder name for journal files relative to vault root (default: `"1 Journal"`).
* `personal-assistant.journalTasksHeading`: Heading for tasks section in journals (default: `"## Tasks This Week"`).
* `personal-assistant.allowNoteDeletion`: Allow AI agents to delete notes (default: `false`). Enable with caution.
* `personal-assistant.contentPreviewLength`: Number of characters in content previews when searching (default: `200`, range: 50-2000).

## Getting Started

1. **Configure Vault Path**: Set `personal-assistant.vaultPath` to point to your Obsidian vault, or open your vault as a workspace folder
2. **Open Copilot Chat**: Press `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (macOS)
3. **Start with Journal**: Type `@journal` to interact with your journal
4. **Try Commands**:
   - "Add an entry to my journal about today's meeting with the team"
   - "What did I do last week according to my journal?"
   - "Add a task to follow up with Sarah about the project"
   - "Search my notes for information about TypeScript"

## Example Usage

### Journal Entry
```
@journal Add an entry: Met with the design team to discuss Q1 roadmap. 
Key decisions: Focus on mobile experience, defer analytics dashboard.
```

### Task Management
```
@journal Add a task: Review PR #145 and provide feedback by Friday
```

### Note Search
```
@journal Find notes about "machine learning" and summarize key concepts
```

### Date Queries
```
@journal What's the date for next Tuesday?
```

## Commands

- **Personal Assistant: Hello World** - Test command to verify extension is active
- **Personal Assistant: Configuration Details** - Display current configuration and vault path

## Known Issues

- Journal files must follow ISO week format (YYYY-Www.md) for proper date parsing
- Path normalization on Windows may show backslashes in some error messages
- Large vaults (>1000 files) may experience slower initial indexing

Please report issues on the [GitHub repository](https://github.com/sytone/vscode-personal-assistant/issues).

## Release Notes

### 0.0.1

Initial development release featuring:
- Journal management tools (read, write, tasks)
- Note management tools (CRUD operations, search)
- Date utility tools (relative dates, week planning)
- GitHub Copilot chat participant integration
- Obsidian vault integration
- Test-driven development with comprehensive test coverage

---

## Development

This extension follows Test-Driven Development (TDD) practices with comprehensive test coverage. See [.github/copilot-instructions.md](.github/copilot-instructions.md) for development guidelines.

### Building from Source

```bash
npm install
npm run compile
npm test
```

### Packaging

```bash
npm run vscode:prepublish
vsce package
```

## Contributing

Contributions are welcome! Please ensure all code includes:
- Comprehensive JSDoc documentation
- Full test coverage following TDD principles
- TypeScript strict mode compliance

## License

See [LICENSE](LICENSE) file for details.

**Enjoy your AI-powered personal knowledge assistant!**
