# Personal Assistant for VS Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/sytone.personal-assistant)](https://marketplace.visualstudio.com/items?itemName=sytone.personal-assistant)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/sytone.personal-assistant)](https://marketplace.visualstudio.com/items?itemName=sytone.personal-assistant)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

- **VS Code**: Version 1.105.0 or higher
- **GitHub Copilot**: Active subscription (required for chat participant features)
- **Knowledge Base**: An Obsidian vault or markdown-based directory (optional but recommended)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS) to open Extensions
3. Search for "Personal Assistant"
4. Click **Install**

### From VSIX File

1. Download the `.vsix` file from the [releases page](https://github.com/sytone/vscode-personal-assistant/releases)
2. In VS Code, press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
3. Type "Install from VSIX" and select the command
4. Browse to the downloaded `.vsix` file

## Extension Settings

This extension contributes the following settings:

### Vault Configuration
* `personal-assistant.vaultPath`: Path to your Obsidian vault root directory. If not set, uses the first workspace folder containing an `.obsidian` folder.

### Journal Settings
* `personal-assistant.journalFolderName`: Folder name for journal files relative to vault root (default: `"1 Journal"`).
* `personal-assistant.journalTasksHeading`: Heading for tasks section in journals (default: `"## Tasks This Week"`).
* `personal-assistant.journalTemplateName`: Template file name (without extension) used to seed new weekly journal files (default: `"journal-weekly"`).

### Template Settings
* `personal-assistant.templatesFolderName`: Folder (relative to vault root) that stores markdown templates used by journal and note tools (default: `"Templates"`).

### Note Management Settings
* `personal-assistant.allowNoteDeletion`: Allow AI agents to delete notes (default: `false`). Enable with caution.
* `personal-assistant.contentPreviewLength`: Number of characters in content previews when searching (default: `200`, range: 50-2000).

## Getting Started

1. **Configure Vault Path**: 
   - Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
   - Search for "Personal Assistant"
   - Set `personal-assistant.vaultPath` to point to your Obsidian vault
   - Alternatively, open your vault as a workspace folder in VS Code
   
2. **Open Copilot Chat**: 
   - Press `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (macOS)
   - Or click the chat icon in the Activity Bar
   
3. **Start with Journal**: 
   - Type `@journal` to interact with your journal
   - Try the slash commands for quick actions: `/add`, `/meeting`, `/summarize`
   
4. **Example Commands**:
   - "Add an entry to my journal about today's meeting with the team"
   - "What did I do last week according to my journal?"
   - "Add a task to follow up with Sarah about the project"
   - "Search my notes for information about TypeScript"
   - "Create a new note in my projects folder about the Q1 roadmap"


## Example Usage

### Adding a Journal Entry
```
@journal Add an entry: Met with the design team to discuss Q1 roadmap. 
Key decisions: Focus on mobile experience, defer analytics dashboard.
```

### Managing Tasks
```
@journal Add a task: Review PR #145 and provide feedback by Friday
```

Or use the slash command:
```
@journal /add Review PR #145 and provide feedback by Friday
```

### Starting a Meeting
```
@journal /meeting Weekly Team Sync
```

This creates a meeting context where the AI will automatically track discussion points and action items.

### Searching Notes
```
@journal Find notes about "machine learning" and summarize key concepts
```

### Creating a New Note
```
@journal Create a note in my projects folder about the new feature requirements
```

### Querying Dates
```
@journal What's the date for next Tuesday?
```


## Commands

Access these commands via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Personal Assistant: Hello World** - Test command to verify extension is active
- **Personal Assistant: Configuration Details** - Display current configuration and vault path

## Chat Participant Commands

When using `@journal` in Copilot Chat, you can use these slash commands:

- `/add` - Add an entry to today's journal
- `/meeting <title>` - Start tracking a meeting with the given title
- `/endMeeting` - End the current meeting and add all notes to the journal
- `/summarize` - Summarize the current meeting or create a summary journal entry
- `/randomTeach` - Learn a random computer science concept (explained by a cat!)
- `/play` - Let the cat play (just for fun!)

## Troubleshooting

### Extension Not Working

**Q: The `@journal` participant doesn't appear in Copilot Chat**
- Ensure you have GitHub Copilot installed and activated
- Reload VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")
- Check the Output panel (`View` → `Output`) and select "Personal Assistant" from the dropdown

**Q: "No vault root configured" error**
- Set `personal-assistant.vaultPath` in your settings, or
- Open a folder containing an `.obsidian` directory as your workspace

**Q: Journal entries are not being created**
- Verify the journal folder exists at the configured path (default: `1 Journal`)
- Check file permissions in your vault directory
- Ensure the path uses forward slashes or proper escaped backslashes

### Performance Issues

**Q: Search is slow with large vaults**
- Use more specific search terms to reduce result sets
- Set `includeContent: false` when searching (this is the default)
- Consider organizing notes into subfolders and searching specific folders

**Q: Content preview is too long/short**
- Adjust `personal-assistant.contentPreviewLength` (default: 200, range: 50-2000)

### Date and Time Issues

**Q: Journal entries have wrong timestamps**
- The extension uses local time, not UTC
- Check your system time and timezone settings
- ISO week format follows ISO 8601 standard (weeks start on Monday)

## Known Issues

- Journal files must follow ISO week format (YYYY-Www.md) for proper date parsing
- Path normalization on Windows may show backslashes in some error messages
- Large vaults (>1000 files) may experience slower initial indexing when searching

**Found a bug?** Please report issues on the [GitHub repository](https://github.com/sytone/vscode-personal-assistant/issues).

## Release Notes

### 1.1.0 (November 20, 2025)

#### New Features
- **Comprehensive Note Management**: Full CRUD operations for notes with frontmatter support
  - Search by filename, content, or frontmatter metadata
  - Create, read, update, and delete notes programmatically
  - Update frontmatter without modifying note content
  - Configurable content preview length for search results
- **Template Service**: Support for markdown templates in journals and notes
- **Enhanced Testing**: Expanded test coverage for note management and template services
- **Build Improvements**: Better watch mode logging in esbuild

#### Configuration Updates
- Added `personal-assistant.templatesFolderName` setting (default: "Templates")
- Added `personal-assistant.journalTemplateName` setting (default: "journal-weekly")
- Added `personal-assistant.contentPreviewLength` setting (default: 200)
- Added `personal-assistant.allowNoteDeletion` safety setting (default: false)

### 1.0.0 (November 4, 2025)

Initial release featuring:
- Journal management tools (read, write, tasks)
- Date utility tools (relative dates, week planning)
- GitHub Copilot chat participant integration
- Obsidian vault integration
- Test-driven development with comprehensive test coverage
- File search functionality

---

## Contributing

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

**Before contributing, please read our [Contributing Guidelines](CONTRIBUTING.md)** which cover:

- Development setup and workflow
- Coding standards and best practices
- Test-Driven Development (TDD) requirements
- Pull request process
- Project structure and architecture

### Quick Start for Contributors

```bash
# Fork and clone the repository
git clone https://github.com/YOUR-USERNAME/vscode-personal-assistant.git
cd vscode-personal-assistant

# Install dependencies
npm install

# Run tests to verify setup
npm test

# Start development in watch mode
npm run watch
```

For detailed instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/sytone/vscode-personal-assistant/issues)
- **Discussions**: Ask questions or share ideas on [GitHub Discussions](https://github.com/sytone/vscode-personal-assistant/discussions)

---

**Enjoy your AI-powered personal knowledge assistant!** 🚀