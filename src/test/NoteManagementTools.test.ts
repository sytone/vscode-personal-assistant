import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  ListFilesTool,
  SearchFilesByNameTool,
  SearchFilesByContentTool,
  SearchNotesByFrontmatterTool,
  ReadNoteTool,
  CreateNoteTool,
  UpdateNoteTool,
  UpdateNoteFrontmatterTool,
  DeleteNoteTool,
} from '../tools/NoteManagementTools';
import { setVaultRootForTesting, getVaultRoot } from '../extension';

// Force recompilation

// Test Helpers
async function createTestWorkspace(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'note-test-'));
  await fs.mkdir(path.join(tmpDir, '.obsidian'));
  console.log(`Created test workspace at: ${tmpDir}`);
  return tmpDir;
}

async function cleanupTestWorkspace(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

async function createTestNote(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<string> {
  const fullPath = path.join(workspaceRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');
  return fullPath;
}

async function readTestFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

async function writeTestFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

suite('ListFilesTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    console.log('[ListFilesTool] Setting vault root to:', testWorkspaceRoot);
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should list all markdown files in vault', async () => {
    await createTestNote(testWorkspaceRoot, 'note1.md', '# Note 1');
    await createTestNote(testWorkspaceRoot, 'folder/note2.md', '# Note 2');

    const tool = new ListFilesTool();
    const result = await tool.invoke(
      { input: {}, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    const output = parts[0].value;
    
    if (!output.includes('note1.md') || !output.includes('folder/note2.md')) {
      throw new Error(`Test failed. Output was:\n${output}\n\nChecks:\n- includes 'note1.md': ${output.includes('note1.md')}\n- includes 'folder/note2.md': ${output.includes('folder/note2.md')}`);
    }
    
    assert.ok(output.includes('note1.md'), `Expected 'note1.md' in: ${output}`);
    assert.ok(output.includes('folder/note2.md'), `Expected 'folder/note2.md' in: ${output}`);
  });

  test('should filter files by folder path', async () => {
    await createTestNote(testWorkspaceRoot, 'note1.md', '# Note 1');
    await createTestNote(testWorkspaceRoot, 'projects/note2.md', '# Project Note');
    await createTestNote(testWorkspaceRoot, 'personal/note3.md', '# Personal Note');

    const tool = new ListFilesTool();
    const result = await tool.invoke(
      { input: { folderPath: 'projects' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('projects/note2.md'));
    assert.ok(!parts[0].value.includes('note1.md'));
    assert.ok(!parts[0].value.includes('personal/note3.md'));
  });

  test('should skip system folders (.obsidian, .git, hidden)', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Note');
    await createTestNote(testWorkspaceRoot, '.obsidian/workspace.json', '{}');
    await createTestNote(testWorkspaceRoot, '.git/config', 'config');
    await createTestNote(testWorkspaceRoot, '.hidden/note.md', '# Hidden');

    const tool = new ListFilesTool();
    const result = await tool.invoke(
      { input: {}, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('note.md'));
    assert.ok(!parts[0].value.includes('.obsidian'));
    assert.ok(!parts[0].value.includes('.git'));
    assert.ok(!parts[0].value.includes('.hidden'));
  });

  test('should include content preview when includeContent is true', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      'This is the content of the note that should be previewed.'
    );

    const tool = new ListFilesTool();
    const result = await tool.invoke(
      { input: { includeContent: true }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('This is the content'));
  });

  test('should not include content when includeContent is false', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      'This is the content of the note.'
    );

    const tool = new ListFilesTool();
    const result = await tool.invoke(
      { input: { includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(!parts[0].value.includes('This is the content'));
  });

  test('should handle empty vault gracefully', async () => {
    const tool = new ListFilesTool();
    const result = await tool.invoke(
      { input: {}, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('No markdown files found'));
  });
});

suite('SearchFilesByNameTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should find files by name pattern (case-insensitive)', async () => {
    await createTestNote(testWorkspaceRoot, 'project-notes.md', '# Project');
    await createTestNote(testWorkspaceRoot, 'meeting-notes.md', '# Meeting');
    await createTestNote(testWorkspaceRoot, 'todo.md', '# Todo');

    const tool = new SearchFilesByNameTool();
    const result = await tool.invoke(
      { input: { namePattern: 'notes' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('project-notes.md'));
    assert.ok(parts[0].value.includes('meeting-notes.md'));
    assert.ok(!parts[0].value.includes('todo.md'));
  });

  test('should handle special characters in search pattern', async () => {
    await createTestNote(testWorkspaceRoot, 'file-2024.md', '# File 2024');
    await createTestNote(testWorkspaceRoot, 'file_2024.md', '# File 2024');

    const tool = new SearchFilesByNameTool();
    const result = await tool.invoke(
      { input: { namePattern: '2024' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('file-2024.md'));
    assert.ok(parts[0].value.includes('file_2024.md'));
  });

  test('should return no matches message when pattern not found', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Note');

    const tool = new SearchFilesByNameTool();
    const result = await tool.invoke(
      { input: { namePattern: 'nonexistent' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('No files found'));
  });
});

suite('SearchFilesByContentTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should find files containing search text (case-insensitive)', async () => {
    await createTestNote(testWorkspaceRoot, 'note1.md', 'This note contains important information.');
    await createTestNote(testWorkspaceRoot, 'note2.md', 'Another file with different content.');
    await createTestNote(testWorkspaceRoot, 'note3.md', 'IMPORTANT: This is uppercase.');

    const tool = new SearchFilesByContentTool();
    const result = await tool.invoke(
      { input: { searchText: 'important', includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('note1.md'));
    assert.ok(parts[0].value.includes('note3.md'));
    assert.ok(!parts[0].value.includes('note2.md'));
  });

  test('should include full content when includeContent is true', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', 'Search term here with more content.');

    const tool = new SearchFilesByContentTool();
    const result = await tool.invoke(
      { input: { searchText: 'term', includeContent: true }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Search term here with more content'));
  });

  test('should not include content when includeContent is false', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', 'Search term here.');

    const tool = new SearchFilesByContentTool();
    const result = await tool.invoke(
      { input: { searchText: 'term', includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('note.md'));
    assert.ok(!parts[0].value.includes('Search term here'));
  });

  test('should handle empty search results', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', 'Content without match.');

    const tool = new SearchFilesByContentTool();
    const result = await tool.invoke(
      { input: { searchText: 'nonexistent', includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('No files found'));
  });
});

suite('SearchNotesByFrontmatterTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should find notes by exact frontmatter key-value match', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note1.md',
      '---\ntag: project\nstatus: active\n---\n# Note 1'
    );
    await createTestNote(
      testWorkspaceRoot,
      'note2.md',
      '---\ntag: personal\nstatus: active\n---\n# Note 2'
    );

    const tool = new SearchNotesByFrontmatterTool();
    const result = await tool.invoke(
      { input: { key: 'tag', value: 'project', includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('note1.md'));
    assert.ok(!parts[0].value.includes('note2.md'));
  });

  test('should find notes by frontmatter key existence (no value specified)', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note1.md',
      '---\ntag: project\n---\n# Note 1'
    );
    await createTestNote(testWorkspaceRoot, 'note2.md', '# Note 2');

    const tool = new SearchNotesByFrontmatterTool();
    const result = await tool.invoke(
      { input: { key: 'tag', includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('note1.md'));
    assert.ok(!parts[0].value.includes('note2.md'));
  });

  test('should handle notes without frontmatter', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Note without frontmatter');

    const tool = new SearchNotesByFrontmatterTool();
    const result = await tool.invoke(
      { input: { key: 'tag', includeContent: false }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('No files found'));
  });

  test('should include content when includeContent is true', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntag: test\n---\n# Test Note Content'
    );

    const tool = new SearchNotesByFrontmatterTool();
    const result = await tool.invoke(
      { input: { key: 'tag', value: 'test', includeContent: true }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Test Note Content'));
  });
});

suite('ReadNoteTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should read note with frontmatter and content', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntitle: Test Note\ntag: project\n---\n# Content\nThis is the note content.'
    );

    const tool = new ReadNoteTool();
    const result = await tool.invoke(
      { input: { notePath: 'note.md' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    const output = parts[0].value;
    assert.ok(output.includes('title: Test Note'));
    assert.ok(output.includes('tag: project'));
    assert.ok(output.includes('This is the note content'));
  });

  test('should read note without frontmatter', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Simple Note\nJust content.');

    const tool = new ReadNoteTool();
    const result = await tool.invoke(
      { input: { notePath: 'note.md' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Just content'));
  });

  test('should handle non-existent file with error', async () => {
    const tool = new ReadNoteTool();
    const result = await tool.invoke(
      { input: { notePath: 'nonexistent.md' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Error') || parts[0].value.includes('not found'));
  });

  test('should prevent path traversal attacks', async () => {
    const tool = new ReadNoteTool();
    const result = await tool.invoke(
      { input: { notePath: '../../../etc/passwd' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Invalid') || parts[0].value.includes('Error'));
  });
});

suite('CreateNoteTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should create note with frontmatter and content', async () => {
    const tool = new CreateNoteTool();
    const result = await tool.invoke(
      {
        input: {
          notePath: 'new-note.md',
          content: 'This is the note content.',
          frontmatter: { title: 'New Note', tag: 'project' },
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('created successfully'));

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'new-note.md'));
    assert.ok(fileContent.includes('title: New Note'));
    assert.ok(fileContent.includes('tag: project'));
    assert.ok(fileContent.includes('This is the note content'));
  });

  test('should create note without frontmatter', async () => {
    const tool = new CreateNoteTool();
    await tool.invoke(
      {
        input: {
          notePath: 'simple-note.md',
          content: 'Just content.',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'simple-note.md'));
    assert.strictEqual(fileContent, 'Just content.');
  });

  test('should apply template content when templateName provided', async () => {
    const templatesDir = path.join(testWorkspaceRoot, 'Templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'note-default.md'),
      ['# {{title}}', '', 'Created: {{created}}', '', '{{content}}'].join('\n'),
      'utf-8'
    );

    const tool = new CreateNoteTool();
    await tool.invoke(
      {
        input: {
          notePath: 'templated-note.md',
          content: 'Body text.',
          templateName: 'note-default',
          templateData: { title: 'Templated', created: '2025-11-19' }
        },
        options: {}
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'templated-note.md'));
    assert.ok(fileContent.includes('# Templated'));
    assert.ok(fileContent.includes('Created: 2025-11-19'));
    assert.ok(fileContent.includes('Body text.'));
  });

  test('should create nested directories automatically', async () => {
    const tool = new CreateNoteTool();
    await tool.invoke(
      {
        input: {
          notePath: 'projects/2024/note.md',
          content: 'Nested note.',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(
      path.join(testWorkspaceRoot, 'projects/2024/note.md')
    );
    assert.strictEqual(fileContent, 'Nested note.');
  });

  test('should return error if file already exists', async () => {
    await createTestNote(testWorkspaceRoot, 'existing.md', '# Existing');

    const tool = new CreateNoteTool();
    const result = await tool.invoke(
      {
        input: {
          notePath: 'existing.md',
          content: 'New content.',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('already exists') || parts[0].value.includes('Error'));
  });

  test('should prevent path traversal in create', async () => {
    const tool = new CreateNoteTool();
    const result = await tool.invoke(
      {
        input: {
          notePath: '../../../tmp/malicious.md',
          content: 'Bad content.',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Invalid') || parts[0].value.includes('Error'));
  });
});

suite('UpdateNoteTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should update content while preserving frontmatter', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntitle: Original\ntag: project\n---\n# Old Content'
    );

    const tool = new UpdateNoteTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          content: '# New Content\nUpdated text.',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.ok(fileContent.includes('title: Original'));
    assert.ok(fileContent.includes('tag: project'));
    assert.ok(fileContent.includes('New Content'));
    assert.ok(fileContent.includes('Updated text'));
    assert.ok(!fileContent.includes('Old Content'));
  });

  test('should update note without frontmatter', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Old Content');

    const tool = new UpdateNoteTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          content: '# New Content',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.strictEqual(fileContent, '# New Content');
  });

  test('should return error for non-existent note', async () => {
    const tool = new UpdateNoteTool();
    const result = await tool.invoke(
      {
        input: {
          notePath: 'nonexistent.md',
          content: 'New content.',
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Error') || parts[0].value.includes('not found'));
  });
});

suite('UpdateNoteFrontmatterTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should set new frontmatter key', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntitle: Test\n---\n# Content'
    );

    const tool = new UpdateNoteFrontmatterTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          operations: [{ action: 'set', key: 'tag', value: 'project' }],
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.ok(fileContent.includes('title: Test'));
    assert.ok(fileContent.includes('tag: project'));
    assert.ok(fileContent.includes('# Content'));
  });

  test('should update existing frontmatter key', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntitle: Old Title\n---\n# Content'
    );

    const tool = new UpdateNoteFrontmatterTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          operations: [{ action: 'set', key: 'title', value: 'New Title' }],
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.ok(fileContent.includes('title: New Title'));
    assert.ok(!fileContent.includes('Old Title'));
  });

  test('should delete frontmatter key', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntitle: Test\ntag: project\n---\n# Content'
    );

    const tool = new UpdateNoteFrontmatterTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          operations: [{ action: 'delete', key: 'tag' }],
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.ok(fileContent.includes('title: Test'));
    assert.ok(!fileContent.includes('tag:'));
  });

  test('should handle multiple operations in one call', async () => {
    await createTestNote(
      testWorkspaceRoot,
      'note.md',
      '---\ntitle: Old\ntag: old-tag\n---\n# Content'
    );

    const tool = new UpdateNoteFrontmatterTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          operations: [
            { action: 'set', key: 'title', value: 'New Title' },
            { action: 'delete', key: 'tag' },
            { action: 'set', key: 'status', value: 'active' },
          ],
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.ok(fileContent.includes('title: New Title'));
    assert.ok(!fileContent.includes('tag:'));
    assert.ok(fileContent.includes('status: active'));
  });

  test('should create frontmatter section if none exists', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Content without frontmatter');

    const tool = new UpdateNoteFrontmatterTool();
    await tool.invoke(
      {
        input: {
          notePath: 'note.md',
          operations: [{ action: 'set', key: 'title', value: 'New Title' }],
        },
        options: {},
      } as any,
      {} as vscode.CancellationToken
    );

    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.ok(fileContent.includes('---'));
    assert.ok(fileContent.includes('title: New Title'));
    assert.ok(fileContent.includes('# Content without frontmatter'));
  });
});

suite('DeleteNoteTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should reject deletion when allowNoteDeletion is false', async () => {
    await createTestNote(testWorkspaceRoot, 'note.md', '# Note');

    const tool = new DeleteNoteTool();
    const result = await tool.invoke(
      { input: { notePath: 'note.md' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('not allowed') || parts[0].value.includes('disabled'));

    // Verify file still exists
    const fileContent = await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
    assert.strictEqual(fileContent, '# Note');
  });

  test('should delete note when allowNoteDeletion is true', async function () {
    // Mock configuration to allow deletion
    const originalGetConfig = vscode.workspace.getConfiguration;
    (vscode.workspace as any).getConfiguration = (section?: string) => {
      if (section === 'personal-assistant') {
        return {
          get: (key: string, defaultValue?: any) => {
            if (key === 'vaultPath') { return testWorkspaceRoot; }
            if (key === 'allowNoteDeletion') { return true; }
            if (key === 'contentPreviewLength') { return 200; }
            return defaultValue;
          },
        };
      }
      return originalGetConfig(section);
    };

    await createTestNote(testWorkspaceRoot, 'note.md', '# Note to delete');

    const tool = new DeleteNoteTool();
    const result = await tool.invoke(
      { input: { notePath: 'note.md' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('deleted successfully'));

    // Verify file no longer exists
    try {
      await readTestFile(path.join(testWorkspaceRoot, 'note.md'));
      assert.fail('File should have been deleted');
    } catch (err: any) {
      assert.ok(err.code === 'ENOENT');
    }
  });

  test('should return error for non-existent file', async () => {
    const tool = new DeleteNoteTool();
    const result = await tool.invoke(
      { input: { notePath: 'nonexistent.md' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Error') || parts[0].value.includes('not found'));
  });

  test('should prevent path traversal in delete', async () => {
    const tool = new DeleteNoteTool();
    const result = await tool.invoke(
      { input: { notePath: '../../../etc/passwd' }, options: {} } as any,
      {} as vscode.CancellationToken
    );

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('Invalid') || parts[0].value.includes('Error'));
  });
});
