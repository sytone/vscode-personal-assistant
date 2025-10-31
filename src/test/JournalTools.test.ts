import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { AddJournalEntryTool, AddJournalTaskTool, ReadJournalEntriesTool } from '../tools/JournalTools';
import { setVaultRootForTesting } from '../extension';

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

  suite('Integration Tests', () => {
    test('should handle complete workflow: create, add entries, add tasks, read', async function () {
      this.timeout(MARKDOWNLINT_TIMEOUT);
      const tool1 = new AddJournalEntryTool();
      const tool2 = new AddJournalTaskTool();
      const tool3 = new ReadJournalEntriesTool();

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

      // Add task
      await tool2.invoke({
        input: {
          taskDescription: 'Write tests',
          date: '2025-10-30'
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      // Read back
      const result = await tool3.invoke({
        input: {
          includeContent: true,
          maxEntries: 10
        },
        options: {}
      } as any, {} as vscode.CancellationToken);

      const parts = result.content as vscode.LanguageModelTextPart[];
      const output = parts[0].value;

      assert.ok(output.includes('Morning standup'), 'Should include first entry');
      assert.ok(output.includes('Code review'), 'Should include second entry');
      assert.ok(output.includes('Write tests'), 'Should include task');
      assert.ok(output.includes('## Tasks This Week'), 'Should have tasks section');
      assert.ok(output.includes('## 30 Thursday'), 'Should have day section');
    });
  });
});
