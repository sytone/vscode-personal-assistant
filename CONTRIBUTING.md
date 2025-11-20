# Contributing to Personal Assistant for VS Code

Thank you for your interest in contributing to the Personal Assistant extension! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Project Structure](#project-structure)
- [Additional Resources](#additional-resources)

## Code of Conduct

This project follows a standard code of conduct. Be respectful, inclusive, and constructive in all interactions. We're all here to build something useful together.

## Getting Started

### Prerequisites

- **Node.js**: Version 18.x or higher
- **VS Code**: Version 1.105.0 or higher
- **GitHub Copilot**: For testing chat participant features (optional but recommended)
- **Git**: For version control

### Development Setup

1. **Fork and Clone the Repository**

   ```bash
   # Fork the repository on GitHub first, then:
   git clone https://github.com/YOUR-USERNAME/vscode-personal-assistant.git
   cd vscode-personal-assistant
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Verify Your Setup**

   ```bash
   # Run type checking
   npm run check-types
   
   # Run tests
   npm test
   
   # Compile the extension
   npm run compile
   ```

4. **Open in VS Code**

   ```bash
   code .
   ```

## Development Workflow

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. The extension will be active in the new window
4. Use `@journal` in Copilot Chat to test features

### Development Commands

```bash
# Type checking (without compilation)
npm run check-types

# Compile the extension
npm run compile

# Watch mode - automatically recompiles on file changes
npm run watch

# Run tests
npm test

# Run linter
npm run lint

# Build production version
npm run vscode:prepublish

# Create VSIX package for local testing
npm run package:vsix
```

### Watch Mode for Development

For efficient development, use watch mode which automatically recompiles when you make changes:

```bash
npm run watch
```

This runs both TypeScript type checking and esbuild compilation in watch mode.

## Coding Standards

### Test-Driven Development (TDD)

This project follows **strict Test-Driven Development** practices:

1. **🔴 Red**: Write failing tests that define expected behavior
2. **🟢 Green**: Write minimal code to make tests pass
3. **🔵 Refactor**: Improve code quality while keeping tests green

**Important**: Always write tests BEFORE implementing functionality. See `.github/copilot-instructions.md` for detailed TDD guidelines.

### TypeScript Guidelines

- Use **TypeScript 5.x** with **strict mode** enabled
- All code must pass type checking: `npm run check-types`
- Prefer explicit types over implicit `any`
- Use `async/await` for asynchronous operations
- Use modern ES2024+ features where appropriate

### Code Style

- **Indentation**: Use tabs (project standard)
- **Quotes**: Single quotes for strings
- **Semicolons**: Use semicolons
- **Line Length**: Aim for 120 characters max
- **Naming Conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_SNAKE_CASE` for constants
  - Interface names prefixed with `I` (e.g., `IToolParameters`)

### Documentation Standards

All code must include comprehensive JSDoc documentation:

#### Required Documentation

- **Classes**: Include class-level JSDoc with description and `@remarks`
- **Interfaces**: Document the interface purpose and all properties
- **Public Functions**: Include `@param`, `@returns`, and `@remarks`
- **Complex Logic**: Add inline comments explaining non-obvious code

#### JSDoc Format

```typescript
/**
 * Brief one-line description of the function/class.
 * More detailed explanation if needed (optional).
 *
 * @param paramName - Description of the parameter
 * @returns Description of return value
 *
 * @remarks
 * Additional context about usage patterns, security considerations,
 * or performance implications.
 *
 * @example
 * ```typescript
 * const result = myFunction('input');
 * ```
 */
```

### File Organization

```
src/
├── extension.ts              # Extension activation and vault root management
├── chatParticipants/         # Chat participant implementations
│   ├── chatParticipants.ts
│   └── journal.tsx
├── commands/                 # VSCode commands
│   └── commands.ts
├── services/                 # Business logic services
│   ├── DateService.ts
│   └── TemplateService.ts
├── tools/                    # Language model tools
│   ├── tools.ts             # Tool registration
│   ├── JournalTools.ts
│   ├── DateUtilityTools.ts
│   ├── NoteManagementTools.ts
│   └── markdownlint-rules/
└── test/                     # Test files
    ├── *.test.ts            # Test files matching source files
    └── ...
```

## Testing Requirements

### Test Coverage

Every feature must have comprehensive test coverage:

- ✅ **Happy path** scenarios
- ✅ **Edge cases** (empty inputs, special characters, boundary conditions)
- ✅ **Error conditions** and error messages
- ✅ **Formatting and spacing** (for content-generating tools)
- ✅ **Integration** between related tools

### Test Structure

Tests are located in `src/test/` with naming pattern `ToolName.test.ts`:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { MyTool } from '../tools/MyTools';

suite('MyTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    // Setup test environment
  });

  teardown(async () => {
    // Cleanup
  });

  test('should handle basic functionality', async () => {
    // Test implementation
  });

  test('should handle edge case: empty input', async () => {
    // Test edge cases
  });

  test('should handle error: invalid parameter', async () => {
    // Test error conditions
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Compile tests first (if needed)
npm run pretest
```

## Submitting Changes

### Before You Submit

1. **Create an Issue**: For significant changes, open an issue first to discuss your proposal
2. **Write Tests**: Follow TDD - write tests before implementation
3. **Follow Standards**: Ensure code meets all coding standards
4. **Run Checks**: Verify all checks pass:
   ```bash
   npm run check-types
   npm run lint
   npm test
   ```
5. **Update Documentation**: Update README.md or other docs if needed

### Pull Request Process

1. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make Your Changes**

   - Write tests first (TDD)
   - Implement the feature/fix
   - Ensure all tests pass
   - Add JSDoc documentation
   - Update relevant documentation

3. **Commit Your Changes**

   Use [Conventional Commits](https://www.conventionalcommits.org/) format:

   ```
   feat: add support for daily journal entries
   fix: resolve timezone issue in date parsing
   docs: update installation instructions
   test: add edge case tests for note creation
   refactor: simplify frontmatter parsing logic
   ```

4. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**

   - Use a clear, descriptive title
   - Reference any related issues (e.g., "Fixes #123")
   - Describe what changed and why
   - List any breaking changes
   - Include screenshots/demos if relevant

### Pull Request Checklist

- [ ] Tests added/updated and passing
- [ ] Code follows project style guidelines
- [ ] JSDoc documentation added for new code
- [ ] TypeScript strict mode compliance
- [ ] No linting errors
- [ ] README or other docs updated if needed
- [ ] Conventional commit messages used
- [ ] Branch is up to date with main

## Project Structure

### Key Components

#### Tools (`src/tools/`)

Language Model Tools that GitHub Copilot can invoke:

- **JournalTools.ts**: Journal entry and task management
- **DateUtilityTools.ts**: Date calculation and information
- **NoteManagementTools.ts**: CRUD operations for notes
- **FindFilesTool.ts**: File search functionality

Each tool must be registered in `tools.ts` and defined in `package.json`.

#### Services (`src/services/`)

Reusable business logic:

- **DateService.ts**: Date parsing and formatting utilities
- **TemplateService.ts**: Markdown template handling

#### Chat Participants (`src/chatParticipants/`)

Chat participant implementation using `@vscode/prompt-tsx`:

- **journal.tsx**: Main `@journal` participant with slash commands

### Adding New Tools

See `.github/copilot-instructions.md` for detailed step-by-step instructions on adding new tools following TDD practices.

### Configuration

Extension settings are defined in `package.json` under `contributes.configuration`. Each setting should have:

- Clear description
- Appropriate type
- Default value
- Validation (min/max for numbers)

## Additional Resources

### Documentation

- **Project Instructions**: `.github/copilot-instructions.md` - Comprehensive development guidelines
- **TypeScript Guidelines**: `.github/instructions/typescript-5-es2024.instructions.md`
- **Changelog**: `CHANGELOG.md` - Auto-generated from semantic releases

### External Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [GitHub Copilot Extension Development](https://github.com/microsoft/vscode-copilot)
- [Language Model Tools Documentation](https://code.visualstudio.com/api/extension-guides/language-model)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

### Getting Help

- **Questions**: Open a [discussion](https://github.com/sytone/vscode-personal-assistant/discussions)
- **Bugs**: Open an [issue](https://github.com/sytone/vscode-personal-assistant/issues)
- **Chat**: Join project discussions on GitHub

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and releases based on commit messages.

- Commits following Conventional Commits format automatically trigger releases
- Version numbers are determined by commit types (`feat`, `fix`, etc.)
- Changelog is auto-generated from commit messages
- Releases are published to the VS Code Marketplace automatically

---

Thank you for contributing to Personal Assistant! Your efforts help make this tool better for everyone. 🚀
