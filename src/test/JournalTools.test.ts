import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { AddJournalEntryTool, AddJournalTaskTool, ReadJournalEntriesTool, CompleteJournalTaskTool, ReadJournalTasksTool } from '../tools/JournalTools';
import { setJournalTemplateNameForTesting, setVaultRootForTesting } from '../extension';

suite('Journal Tools Test Suite', () => {
  let testWorkspaceRoot: string;
  let testJournalPath: string;

  // Increase timeout for tests that use markdownlint (dynamic imports are slow)
  const MARKDOWNLINT_TIMEOUT = 10000; // 10 seconds

  // Helper to create a temporary test directory
  async function createTestWorkspace(): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'journal-test-'));
    // Create .obsidian folder to mark it as a valid vault
    await fs.mkdir(path.join(tmpDir, '.obsidian'));
    return tmpDir;
  }

  // Helper to clean up test directory
  async function cleanupTestWorkspace(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  // Helper to read file content
  async function readJournalFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  // Helper to write file content
  async function writeJournalFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    testJournalPath = path.join(testWorkspaceRoot, '1 Journal');
    // Set the vault root for testing
    setVaultRootForTesting(testWorkspaceRoot);
  });

  teardown(async () => {
    // Reset vault root
    setVaultRootForTesting(null);
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  suite('AddJournalEntryTool', () => {
    test('should create new weekly file with proper structure', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const tool = new AddJournalEntryTool();

      const result = await tool.invoke({
        input: {
          entryContent: 'First test entry',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Verify the file was created
      const expectedPath = path.join(testJournalPath, '2025', '2025-W44.md');
      const fileExists = await fs.access(expectedPath).then(() => true).catch(() => false);
      assert.strictEqual(fileExists, true, 'Weekly file should be created');

      // Verify content structure
      const content = await readJournalFile(expectedPath);
      const lines = content.split(/\r?\n/);

      // Check for title
      assert.ok(lines.some(l => l.includes('# Week 44 in 2025')), 'Should have week title');

      // Check for day heading
      assert.ok(lines.some(l => l.trim() === '## 30 Thursday'), 'Should have day heading');

      // Check for entry with timestamp
      assert.ok(lines.some(l => l.match(/^- \d{2}:\d{2} - First test entry$/)), 'Should have timestamped entry');
    });

    test('should seed new weekly file from template when available', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const templateDir = path.join(testWorkspaceRoot, 'Templates');
      await fs.mkdir(templateDir, { recursive: true });
      const templatePath = path.join(templateDir, 'journal-weekly.md');
      const templateContent = [
        '# Custom Week {{weekNumber}} in {{year}}',
        '',
        '{{#each days}}',
        '## {{dayNumber}} {{dayName}}',
        '',
        '{{/each}}'
      ].join('\n');
      await fs.writeFile(templatePath, templateContent, 'utf-8');

      const tool = new AddJournalEntryTool();

      await tool.invoke({
        input: {
          entryContent: 'Templated entry',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const expectedPath = path.join(testJournalPath, '2025', '2025-W44.md');
      const content = await readJournalFile(expectedPath);
      assert.ok(content.startsWith('# Custom Week 44 in 2025'), 'Template header should be applied');
      assert.ok(content.includes('## 30 Thursday'), 'Template should include day headings');
    });

    test('should respect configured journal template name', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const templateDir = path.join(testWorkspaceRoot, 'Templates');
      await fs.mkdir(templateDir, { recursive: true });
      const templatePath = path.join(templateDir, 'weekly-custom.md');
      const templateContent = [
        '# Configurable Week {{weekNumber}} in {{year}}',
        '',
        '{{#each days}}',
        '## {{dayNumber}} {{dayName}}',
        '',
        '{{/each}}'
      ].join('\n');
      await fs.writeFile(templatePath, templateContent, 'utf-8');

      setJournalTemplateNameForTesting('weekly-custom');

      try {
        const tool = new AddJournalEntryTool();

        await tool.invoke({
          input: {
            entryContent: 'Configurable template entry',
            date: '2025-10-30'
          },
          options: {}
        } as any, {} as vscode.CancellationToken);

        const expectedPath = path.join(testJournalPath, '2025', '2025-W44.md');
        const content = await readJournalFile(expectedPath);
        assert.ok(content.startsWith('# Configurable Week 44 in 2025'), 'Configured template header should be applied');
        assert.ok(content.includes('## 30 Thursday'), 'Configured template should include day headings');
      } finally {
        setJournalTemplateNameForTesting(null);
      }
    });

    test('should add entry to existing day section', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      // Create initial file with one entry
      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - First entry',
        '',
        '## 31 Friday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalEntryTool();
      await tool.invoke({
        input: {
          entryContent: 'Second entry',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      // Find the Thursday section
      const thursdayIndex = lines.findIndex(l => l.trim() === '## 30 Thursday');
      assert.ok(thursdayIndex >= 0, 'Thursday section should exist');

      // Find Friday section
      const fridayIndex = lines.findIndex(l => l.trim() === '## 31 Friday');
      assert.ok(fridayIndex >= 0, 'Friday section should exist');

      // Extract Thursday section
      const thursdaySection = lines.slice(thursdayIndex, fridayIndex);

      // Should have both entries
      const entries = thursdaySection.filter(l => l.trim().startsWith('- '));
      assert.strictEqual(entries.length, 2, 'Should have 2 entries');
      assert.ok(entries[0].includes('First entry'), 'First entry should be present');
      assert.ok(entries[1].includes('Second entry'), 'Second entry should be added');
    });

    test('should maintain proper spacing: one blank line after heading, no blank lines between entries', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      // Create initial file
      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '- 10:00 - First entry',
        '',
        '- 10:30 - Extra entry',
        '',
        '## 31 Friday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalEntryTool();
      await tool.invoke({
        input: {
          entryContent: 'Second entry',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const expectedSecondEntryTime = new Date().toTimeString().slice(0, 5);
      const expectedSecondEntryContent = `- ${expectedSecondEntryTime} - Second entry`;

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      // Find Thursday section
      const thursdayIndex = lines.findIndex(l => l.trim() === '## 30 Thursday');
      const fridayIndex = lines.findIndex(l => l.trim() === '## 31 Friday');

      // Verify spacing
      assert.strictEqual(lines[thursdayIndex + 1].trim(), '', 'Should have one blank line after heading');
      assert.ok(lines[thursdayIndex + 2].startsWith('- '), 'First entry should follow blank line');
      assert.ok(lines[thursdayIndex + 3].startsWith('- '), 'Second entry should follow immediately (no blank line)');
      assert.ok(lines[thursdayIndex + 4].startsWith('- '), 'Third entry should follow immediately (no blank line)');

      // Verify blank line before next section
      assert.strictEqual(lines[thursdayIndex + 5].trim(), '', 'Should have blank line before next section');
      assert.strictEqual(lines[thursdayIndex + 6].trim(), '## 31 Friday', 'Next section should follow');

      const expectedContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - First entry',
        '- 10:30 - Extra entry',
        expectedSecondEntryContent,
        '',
        '## 31 Friday',
        ''
      ].join('\n');

      // Normalize line endings for comparison (Windows uses \r\n, Unix uses \n)
      const normalizedContent = content.replace(/\r\n/g, '\n');
      assert.strictEqual(normalizedContent, expectedContent, 'Content structure should be maintained');
    });

    test('should maintain proper spacing: complex spacing issues in existing file', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      // Create initial file
      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '- 10:00 - First entry',
        '',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '',
        '',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '',
        '',
        '',
        '',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '',
        '## 31 Friday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalEntryTool();
      await tool.invoke({
        input: {
          entryContent: 'Second entry',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const expectedSecondEntryTime = new Date().toTimeString().slice(0, 5);
      const expectedSecondEntryContent = `- ${expectedSecondEntryTime} - Second entry`;

      const content = await readJournalFile(weeklyFilePath);

      const expectedContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - First entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        '- 10:30 - Entry',
        expectedSecondEntryContent,
        '',
        '## 31 Friday',
        '',
      ].join('\n');

      // Normalize line endings for comparison (Windows uses \r\n, Unix uses \n)
      const normalizedContent = content.replace(/\r\n/g, '\n');
      assert.strictEqual(normalizedContent, expectedContent, 'Content structure should be maintained');
    });

    test('should strip leading dash from entry content', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalEntryTool();
      await tool.invoke({
        input: {
          entryContent: '- Entry with leading dash',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);

      // Should not have double dash: "- HH:mm - - content"
      assert.ok(!content.includes('- - -'), 'Should not have triple dash');
      assert.ok(content.match(/- \d{2}:\d{2} - Entry with leading dash/), 'Should format correctly');
    });

    test('should insert day sections in correct sequential order', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      // Create file with days 27 and 30
      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 27 Monday',
        '',
        '- 10:00 - Monday entry',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - Thursday entry',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      // Add entry for day 29 (should be inserted between 27 and 30)
      const tool = new AddJournalEntryTool();
      await tool.invoke({
        input: {
          entryContent: 'Wednesday entry',
          date: '2025-10-29'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      const mondayIndex = lines.findIndex(l => l.includes('## 27 Monday'));
      const wednesdayIndex = lines.findIndex(l => l.includes('## 29 Wednesday'));
      const thursdayIndex = lines.findIndex(l => l.includes('## 30 Thursday'));

      assert.ok(mondayIndex >= 0, 'Monday should exist');
      assert.ok(wednesdayIndex >= 0, 'Wednesday should be created');
      assert.ok(thursdayIndex >= 0, 'Thursday should exist');

      assert.ok(mondayIndex < wednesdayIndex, 'Wednesday should come after Monday');
      assert.ok(wednesdayIndex < thursdayIndex, 'Wednesday should come before Thursday');
    });
  });

  suite('AddJournalTaskTool', () => {
    test('should create Tasks section if it does not exist', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 27 Monday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Complete project documentation',
          date: '2025-10-27'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);

      assert.ok(content.includes('## Tasks This Week'), 'Should create Tasks section');
      assert.ok(content.includes('- [ ] Complete project documentation'), 'Should add task');
    });

    test('should add task to existing Tasks section', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Existing task',
        '',
        '## 27 Monday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'New task',
          date: '2025-10-27'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      const tasksIndex = lines.findIndex(l => l.trim() === '## Tasks This Week');
      const mondayIndex = lines.findIndex(l => l.trim() === '## 27 Monday');

      // Extract tasks section
      const tasksSection = lines.slice(tasksIndex, mondayIndex);
      const tasks = tasksSection.filter(l => l.trim().startsWith('- ['));

      assert.strictEqual(tasks.length, 2, 'Should have 2 tasks');
      assert.ok(tasks[0].includes('New task'), 'New task should be first');
      assert.ok(tasks[1].includes('Existing task'), 'Existing task should be second');
    });

    test('should maintain proper spacing: one blank line after heading, no blank lines between tasks, one blank line after section', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Existing task 1',
        '',
        '',
        '- [ ] Existing task 2',
        '',
        '',
        '## 27 Monday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'New task',
          date: '2025-10-27'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      const tasksIndex = lines.findIndex(l => l.trim() === '## Tasks This Week');
      const mondayIndex = lines.findIndex(l => l.trim() === '## 27 Monday');

      // Verify proper spacing
      assert.strictEqual(lines[tasksIndex + 1].trim(), '', 'Should have one blank line after heading');
      assert.ok(lines[tasksIndex + 2].startsWith('- ['), 'First task should follow blank line');
      assert.ok(lines[tasksIndex + 3].startsWith('- ['), 'Second task should follow immediately');
      assert.ok(lines[tasksIndex + 4].startsWith('- ['), 'Third task should follow immediately');
      assert.strictEqual(lines[tasksIndex + 5].trim(), '', 'Should have one blank line after tasks');
      assert.strictEqual(lines[tasksIndex + 6].trim(), '## 27 Monday', 'Next section should follow');
    });

    test('should support completed tasks with [x] checkbox', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Incomplete task',
        '',
        '## 27 Monday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Completed task',
          completed: true,
          date: '2025-10-27'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);

      assert.ok(content.includes('- [x] Completed task'), 'Should create completed task with [x]');
    });

    test('should handle messy spacing with multiple blank lines', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      // Create file with terrible spacing
      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '',
        '',
        '- [ ] Task 1',
        '',
        '',
        '- [ ] Task 2',
        '',
        '',
        '',
        '',
        '## 27 Monday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Clean task',
          date: '2025-10-27'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      const tasksIndex = lines.findIndex(l => l.trim() === '## Tasks This Week');
      const mondayIndex = lines.findIndex(l => l.trim() === '## 27 Monday');

      const tasksSection = lines.slice(tasksIndex, mondayIndex);

      // Count blank lines in section (should only be 1 after heading, 1 before next section)
      const blankLines = tasksSection.filter(l => !l.trim()).length;
      assert.strictEqual(blankLines, 2, 'Should clean up to exactly 2 blank lines (one after heading, one at end)');

      // Verify no consecutive blank lines between tasks
      for (let i = tasksIndex + 2; i < mondayIndex - 1; i++) {
        if (!lines[i].trim() && lines[i + 1] && lines[i + 1].startsWith('- [')) {
          assert.fail('Should not have blank line immediately before a task');
        }
      }
    });
  });

  suite('ReadJournalEntriesTool', () => {
    test('should return empty message when no journal files exist', async () => {
      const tool = new ReadJournalEntriesTool();

      const result = await tool.invoke({
        input: {},
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      assert.ok(parts[0].value.includes('No journal entries found'), 'Should return no entries message');
    });

    test('should list journal files without content when includeContent is false', async () => {
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const content = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - Test entry',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, content);

      const tool = new ReadJournalEntriesTool();
      const result = await tool.invoke({
        input: {
          includeContent: false,
          maxEntries: 10
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      assert.ok(output.includes('2025-W44.md'), 'Should list the file');
      assert.ok(!output.includes('Test entry'), 'Should not include file content');
    });

    test('should include file content when includeContent is true', async () => {
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const content = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - Test entry',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, content);

      const tool = new ReadJournalEntriesTool();
      const result = await tool.invoke({
        input: {
          includeContent: true,
          maxEntries: 10
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      assert.ok(output.includes('2025-W44.md'), 'Should list the file');
      assert.ok(output.includes('Test entry'), 'Should include file content');
    });

    test('should filter by date range', async () => {
      // Create multiple weekly files
      const week43Path = path.join(testJournalPath, '2025', '2025-W43.md');
      const week44Path = path.join(testJournalPath, '2025', '2025-W44.md');
      const week45Path = path.join(testJournalPath, '2025', '2025-W45.md');

      await writeJournalFile(week43Path, '# Week 43 in 2025\n\n## 20 Monday\n');
      await writeJournalFile(week44Path, '# Week 44 in 2025\n\n## 27 Monday\n');
      await writeJournalFile(week45Path, '# Week 45 in 2025\n\n## 3 Monday\n');

      const tool = new ReadJournalEntriesTool();
      const result = await tool.invoke({
        input: {
          fromDate: '2025-10-27',
          toDate: '2025-11-02',
          includeContent: false,
          maxEntries: 10
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      assert.ok(output.includes('W44'), 'Should include W44');
      assert.ok(!output.includes('W43'), 'Should not include W43 (before range)');
      // W45 might be included depending on week boundaries
    });

    test('should respect maxEntries limit', async () => {
      // Create 5 weekly files
      for (let week = 40; week <= 44; week++) {
        const filePath = path.join(testJournalPath, '2025', `2025-W${week}.md`);
        await writeJournalFile(filePath, `# Week ${week} in 2025\n`);
      }

      const tool = new ReadJournalEntriesTool();
      const result = await tool.invoke({
        input: {
          maxEntries: 2,
          includeContent: false
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;
      const lines = output.split('\n').filter(l => l.trim());

      assert.strictEqual(lines.length, 2, 'Should return only 2 entries');
    });
  });

  suite('CompleteJournalTaskTool', () => {
    test('should mark existing task as completed', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Review pull request #123',
        '- [ ] Complete project documentation',
        '- [x] Already completed task',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new CompleteJournalTaskTool();
      const result = await tool.invoke({
        input: {
          taskDescription: 'Complete project documentation',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      
      assert.ok(content.includes('- [x] Complete project documentation'), 'Task should be marked as completed');
      assert.ok(content.includes('- [ ] Review pull request #123'), 'Other incomplete tasks should remain unchanged');
      assert.ok(content.includes('- [x] Already completed task'), 'Already completed tasks should remain unchanged');

      const parts = result.content as vscode.LanguageModelTextPart[];
      assert.ok(parts[0].value.includes('marked as completed'), 'Should confirm completion');
    });

    test('should handle partial task description match', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Review pull request #123 for backend changes',
        '- [ ] Complete project documentation',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new CompleteJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'pull request #123',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      assert.ok(content.includes('- [x] Review pull request #123 for backend changes'), 'Should match partial description');
    });

    test('should handle task not found', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Review pull request #123',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new CompleteJournalTaskTool();
      const result = await tool.invoke({
        input: {
          taskDescription: 'Non-existent task',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      assert.ok(parts[0].value.includes('not found'), 'Should indicate task not found');
    });

    test('should handle no tasks section', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - Some entry',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new CompleteJournalTaskTool();
      const result = await tool.invoke({
        input: {
          taskDescription: 'Any task',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      assert.ok(parts[0].value.includes('No tasks section found'), 'Should indicate no tasks section');
    });

    test('should maintain proper spacing after completion', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Task 1',
        '',
        '',
        '- [ ] Task to complete',
        '',
        '- [ ] Task 3',
        '',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new CompleteJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Task to complete',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      const tasksIndex = lines.findIndex(l => l.trim() === '## Tasks This Week');
      const thursdayIndex = lines.findIndex(l => l.trim() === '## 30 Thursday');

      // Verify proper spacing (no consecutive blank lines between tasks)
      for (let i = tasksIndex + 2; i < thursdayIndex - 1; i++) {
        if (!lines[i].trim() && !lines[i + 1].trim()) {
          assert.fail('Should not have consecutive blank lines between tasks');
        }
      }
    });
  });

  suite('ReadJournalTasksTool', () => {
    test('should read tasks from existing tasks section', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Review pull request #123',
        '- [x] Complete project documentation',
        '- [ ] Write unit tests',
        '  - [ ] Test user authentication',
        '  - [x] Test data validation',
        '- [x] Deploy to staging',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new ReadJournalTasksTool();
      const result = await tool.invoke({
        input: {
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      assert.ok(output.includes('Review pull request #123'), 'Should include incomplete parent task');
      assert.ok(output.includes('Complete project documentation'), 'Should include completed parent task');
      assert.ok(output.includes('Write unit tests'), 'Should include parent task with children');
      assert.ok(output.includes('Test user authentication'), 'Should include incomplete child task');
      assert.ok(output.includes('Test data validation'), 'Should include completed child task');
      assert.ok(output.includes('Deploy to staging'), 'Should include completed parent task');
    });

    test('should handle no tasks section', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## 30 Thursday',
        '',
        '- 10:00 - Some entry',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new ReadJournalTasksTool();
      const result = await tool.invoke({
        input: {
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      assert.ok(parts[0].value.includes('No tasks found'), 'Should indicate no tasks found');
    });

    test('should filter by completion status', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Incomplete task 1',
        '- [x] Completed task 1',
        '- [ ] Incomplete task 2',
        '- [x] Completed task 2',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      // Test incomplete only
      const tool = new ReadJournalTasksTool();
      const result1 = await tool.invoke({
        input: {
          date: '2025-10-30',
          showCompleted: false
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts1 = result1.content as vscode.LanguageModelTextPart[];
      const output1 = parts1[0].value;

      assert.ok(output1.includes('Incomplete task 1'), 'Should include incomplete tasks');
      assert.ok(output1.includes('Incomplete task 2'), 'Should include incomplete tasks');
      assert.ok(!output1.includes('Completed task 1'), 'Should not include completed tasks');
      assert.ok(!output1.includes('Completed task 2'), 'Should not include completed tasks');

      // Test completed only
      const result2 = await tool.invoke({
        input: {
          date: '2025-10-30',
          showIncomplete: false
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts2 = result2.content as vscode.LanguageModelTextPart[];
      const output2 = parts2[0].value;

      assert.ok(!output2.includes('Incomplete task 1'), 'Should not include incomplete tasks');
      assert.ok(!output2.includes('Incomplete task 2'), 'Should not include incomplete tasks');
      assert.ok(output2.includes('Completed task 1'), 'Should include completed tasks');
      assert.ok(output2.includes('Completed task 2'), 'Should include completed tasks');
    });

    test('should show parent-child relationships', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Parent Task 1',
        '  - [x] Child Task 1.1',
        '  - [ ] Child Task 1.2',
        '- [x] Parent Task 2',
        '  - [x] Child Task 2.1',
        '- [ ] Standalone Task',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new ReadJournalTasksTool();
      const result = await tool.invoke({
        input: {
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      // Should preserve indentation to show hierarchy
      assert.ok(output.includes('Parent Task 1'), 'Should include parent task');
      assert.ok(output.includes('  - [x] Child Task 1.1'), 'Should include child with proper indentation');
      assert.ok(output.includes('  - [ ] Child Task 1.2'), 'Should include child with proper indentation');
      assert.ok(output.includes('Parent Task 2'), 'Should include completed parent task');
      assert.ok(output.includes('  - [x] Child Task 2.1'), 'Should include completed child task');
      assert.ok(output.includes('Standalone Task'), 'Should include standalone task');
    });

    test('should return summary statistics', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Parent Task 1',
        '  - [x] Child Task 1.1',
        '  - [ ] Child Task 1.2',
        '- [x] Parent Task 2',
        '- [ ] Standalone Task',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new ReadJournalTasksTool();
      const result = await tool.invoke({
        input: {
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      // Should include summary at top or bottom
      assert.ok(output.includes('5 total'), 'Should show total task count');
      assert.ok(output.includes('2 completed'), 'Should show completed count');
      assert.ok(output.includes('3 incomplete'), 'Should show incomplete count');
    });
  });

  suite('AddJournalTaskTool - Parent/Child Support', () => {
    test('should add parent task with child tasks', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Existing task',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Complete feature development',
          childTasks: ['Write unit tests', 'Update documentation', 'Code review'],
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);

      assert.ok(content.includes('- [ ] Complete feature development'), 'Should add parent task');
      assert.ok(content.includes('  - [ ] Write unit tests'), 'Should add first child task with proper indentation');
      assert.ok(content.includes('  - [ ] Update documentation'), 'Should add second child task');
      assert.ok(content.includes('  - [ ] Code review'), 'Should add third child task');
      assert.ok(content.includes('- [ ] Existing task'), 'Should preserve existing tasks');
    });

    test('should add child task to existing parent', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Feature development',
        '  - [ ] Write tests',
        '- [ ] Other task',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Update documentation',
          parentTask: 'Feature development',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);

      assert.ok(content.includes('- [ ] Feature development'), 'Should preserve parent task');
      assert.ok(content.includes('  - [ ] Write tests'), 'Should preserve existing child');
      assert.ok(content.includes('  - [ ] Update documentation'), 'Should add new child task');
      assert.ok(content.includes('- [ ] Other task'), 'Should preserve other tasks');
    });

    test('should handle parent task not found when adding child', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Existing task',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      const result = await tool.invoke({
        input: {
          taskDescription: 'Child task',
          parentTask: 'Non-existent parent',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      assert.ok(parts[0].value.includes('Parent task not found'), 'Should indicate parent not found');
    });

    test('should maintain proper spacing with parent/child hierarchy', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const weeklyFilePath = path.join(testJournalPath, '2025', '2025-W44.md');

      const initialContent = [
        '# Week 44 in 2025',
        '',
        '## Tasks This Week',
        '',
        '- [ ] Task 1',
        '',
        '',
        '- [ ] Task 2',
        '',
        '',
        '## 30 Thursday',
        ''
      ].join('\n');

      await writeJournalFile(weeklyFilePath, initialContent);

      const tool = new AddJournalTaskTool();
      await tool.invoke({
        input: {
          taskDescription: 'Parent with children',
          childTasks: ['Child 1', 'Child 2'],
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const content = await readJournalFile(weeklyFilePath);
      const lines = content.split(/\r?\n/);

      const tasksIndex = lines.findIndex(l => l.trim() === '## Tasks This Week');
      const thursdayIndex = lines.findIndex(l => l.trim() === '## 30 Thursday');

      // Should have proper compact formatting
      const tasksSection = lines.slice(tasksIndex, thursdayIndex);
      const taskLines = tasksSection.filter(l => l.trim().startsWith('- [') || l.trim().startsWith('  - ['));

      // All task lines should be consecutive (no blank lines between them)
      for (let i = 0; i < taskLines.length - 1; i++) {
        const currentIndex = lines.indexOf(taskLines[i]);
        const nextIndex = lines.indexOf(taskLines[i + 1]);
        assert.strictEqual(nextIndex - currentIndex, 1, 'Tasks should be consecutive without blank lines');
      }
    });
  });

  suite('Integration Tests', () => {
    test('should handle complete workflow: create, add entries, add tasks with hierarchy, complete tasks, read', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const tool1 = new AddJournalEntryTool();
      const tool2 = new AddJournalTaskTool();
      const tool3 = new ReadJournalEntriesTool();
      const tool4 = new CompleteJournalTaskTool();
      const tool5 = new ReadJournalTasksTool();

      // Add first entry
      await tool1.invoke({
        input: {
          entryContent: 'Morning standup',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Add second entry
      await tool1.invoke({
        input: {
          entryContent: 'Code review',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Add parent task with children
      await tool2.invoke({
        input: {
          taskDescription: 'Complete feature',
          childTasks: ['Write tests', 'Update docs'],
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Add standalone task
      await tool2.invoke({
        input: {
          taskDescription: 'Deploy to staging',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Complete one of the child tasks
      await tool4.invoke({
        input: {
          taskDescription: 'Write tests',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Read back journal entries
      const result1 = await tool3.invoke({
        input: {
          includeContent: true,
          maxEntries: 10
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts1 = result1.content as vscode.LanguageModelTextPart[];
      const output1 = parts1[0].value;

      assert.ok(output1.includes('Morning standup'), 'Should include first entry');
      assert.ok(output1.includes('Code review'), 'Should include second entry');
      assert.ok(output1.includes('Complete feature'), 'Should include parent task');
      assert.ok(output1.includes('Deploy to staging'), 'Should include standalone task');
      assert.ok(output1.includes('## Tasks This Week'), 'Should have tasks section');
      assert.ok(output1.includes('## 30 Thursday'), 'Should have day section');

      // Read back tasks specifically
      const result2 = await tool5.invoke({
        input: {
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts2 = result2.content as vscode.LanguageModelTextPart[];
      const output2 = parts2[0].value;

      assert.ok(output2.includes('Complete feature'), 'Should show parent task');
      assert.ok(output2.includes('[x] Write tests'), 'Should show completed child task');
      assert.ok(output2.includes('[ ] Update docs'), 'Should show incomplete child task');
      assert.ok(output2.includes('Deploy to staging'), 'Should show standalone task');
    });
  });
});
