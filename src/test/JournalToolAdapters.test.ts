import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { VSCodeConfigProvider } from '../adapters/vscode/VSCodeConfigProvider';
import {
	AddJournalEntryToolAdapter,
	ReadJournalEntriesToolAdapter,
	AddJournalTaskToolAdapter,
	CompleteJournalTaskToolAdapter,
	ReadJournalTasksToolAdapter,
} from '../adapters/vscode/tools/JournalToolAdapters';
import { setVaultRootForTesting } from '../extension';

/**
 * Test suite for the adapter layer.
 * These tests verify that the VS Code adapters correctly wrap the core functionality
 * and integrate with VS Code's Language Model Tool interfaces.
 */
suite('Journal Tool Adapters Test Suite', () => {
	let testWorkspaceRoot: string;
	let testJournalPath: string;

	const MARKDOWNLINT_TIMEOUT = 10000; // 10 seconds for tests using markdownlint

	// Helper to create a temporary test directory
	async function createTestWorkspace(): Promise<string> {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adapter-test-'));
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

	setup(async () => {
		testWorkspaceRoot = await createTestWorkspace();
		testJournalPath = path.join(testWorkspaceRoot, '1 Journal');
		setVaultRootForTesting(testWorkspaceRoot);
	});

	teardown(async () => {
		setVaultRootForTesting(null);
		await cleanupTestWorkspace(testWorkspaceRoot);
	});

	suite('VSCodeConfigProvider', () => {
		test('should provide vault root from test configuration', () => {
			const provider = new VSCodeConfigProvider();
			const context = provider.getContext();

			assert.strictEqual(context.vaultRoot, testWorkspaceRoot, 'Should return test vault root');
		});

	test('should provide default journal path', () => {
		const provider = new VSCodeConfigProvider();
		const context = provider.getContext();

		assert.strictEqual(context.journalPath, '1 Journal', 'Should return default journal path');
	});

	test('should provide default tasks heading', () => {
		const provider = new VSCodeConfigProvider();
		const context = provider.getContext();

		assert.strictEqual(context.tasksHeading, '## Tasks This Week', 'Should return default tasks heading');
	});
	});

	suite('AddJournalEntryToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new AddJournalEntryToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should have invoke method', () => {
			const adapter = new AddJournalEntryToolAdapter();
			assert.strictEqual(typeof adapter.invoke, 'function', 'Should have invoke method');
		});

		test('should have prepareInvocation method', () => {
			const adapter = new AddJournalEntryToolAdapter();
			assert.strictEqual(typeof adapter.prepareInvocation, 'function', 'Should have prepareInvocation method');
		});

		test('should add entry through adapter', async function () {
			this.timeout(MARKDOWNLINT_TIMEOUT);
			const adapter = new AddJournalEntryToolAdapter();

			const result = await adapter.invoke(
				{
					input: {
						entryContent: 'Test entry through adapter',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			const parts = result.content as any[];
			assert.ok(parts[0].value.includes('Added entry'), 'Should return success message');

			// Verify file was created
			const expectedPath = path.join(testJournalPath, '2025', '2025-W44.md');
			const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
			assert.strictEqual(exists, true, 'Journal file should be created');

			const content = await fs.readFile(expectedPath, 'utf-8');
			assert.ok(content.includes('Test entry through adapter'), 'Entry should be in file');
		});
	});

	suite('ReadJournalEntriesToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new ReadJournalEntriesToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should read entries through adapter', async function () {
			this.timeout(MARKDOWNLINT_TIMEOUT);
			// First add an entry
			const addAdapter = new AddJournalEntryToolAdapter();
			await addAdapter.invoke(
				{
					input: {
						entryContent: 'Entry to read',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			// Then read it back
			const readAdapter = new ReadJournalEntriesToolAdapter();
			const result = await readAdapter.invoke(
				{
					input: {
						includeContent: true,
						maxEntries: 10,
					},
					options: {},
				} as any,
				{} as any
			);

			const parts = result.content as any[];
			assert.ok(parts[0].value.includes('Entry to read'), 'Should return the entry content');
		});
	});

	suite('AddJournalTaskToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new AddJournalTaskToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should add task through adapter', async function () {
			this.timeout(MARKDOWNLINT_TIMEOUT);
			const adapter = new AddJournalTaskToolAdapter();

			const result = await adapter.invoke(
				{
					input: {
						taskDescription: 'Test task through adapter',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			const parts = result.content as any[];
			assert.ok(parts[0].value.includes('Added task'), 'Should return success message');

			const expectedPath = path.join(testJournalPath, '2025', '2025-W44.md');
			const content = await fs.readFile(expectedPath, 'utf-8');
			assert.ok(content.includes('Test task through adapter'), 'Task should be in file');
			assert.ok(content.includes('- [ ]'), 'Task should have checkbox');
		});
	});

	suite('CompleteJournalTaskToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new CompleteJournalTaskToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should complete task through adapter', async function () {
			this.timeout(MARKDOWNLINT_TIMEOUT);
			// First add a task
			const addAdapter = new AddJournalTaskToolAdapter();
			await addAdapter.invoke(
				{
					input: {
						taskDescription: 'Task to complete',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			// Then complete it
			const completeAdapter = new CompleteJournalTaskToolAdapter();
			const result = await completeAdapter.invoke(
				{
					input: {
						taskDescription: 'Task to complete',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			const parts = result.content as any[];
			assert.ok(parts[0].value.includes('marked as completed'), 'Should return success message');

			const expectedPath = path.join(testJournalPath, '2025', '2025-W44.md');
			const content = await fs.readFile(expectedPath, 'utf-8');
			assert.ok(content.includes('- [x] Task to complete'), 'Task should be marked complete');
		});
	});

	suite('ReadJournalTasksToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new ReadJournalTasksToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should read tasks through adapter', async function () {
			this.timeout(MARKDOWNLINT_TIMEOUT);
			// First add some tasks
			const addAdapter = new AddJournalTaskToolAdapter();
			await addAdapter.invoke(
				{
					input: {
						taskDescription: 'Task 1',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			await addAdapter.invoke(
				{
					input: {
						taskDescription: 'Task 2',
						completed: true,
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			// Then read them back
			const readAdapter = new ReadJournalTasksToolAdapter();
			const result = await readAdapter.invoke(
				{
					input: {
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			const parts = result.content as any[];
			const output = parts[0].value;
			assert.ok(output.includes('Task 1'), 'Should include incomplete task');
			assert.ok(output.includes('Task 2'), 'Should include completed task');
			assert.ok(output.includes('Summary'), 'Should include summary statistics');
		});
	});

	suite('Integration Tests', () => {
		test('should handle complete workflow through adapters', async function () {
			this.timeout(MARKDOWNLINT_TIMEOUT);

			// Add entry
			const entryAdapter = new AddJournalEntryToolAdapter();
			await entryAdapter.invoke(
				{
					input: {
						entryContent: 'Workflow test entry',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			// Add task
			const taskAdapter = new AddJournalTaskToolAdapter();
			await taskAdapter.invoke(
				{
					input: {
						taskDescription: 'Workflow test task',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			// Complete task
			const completeAdapter = new CompleteJournalTaskToolAdapter();
			await completeAdapter.invoke(
				{
					input: {
						taskDescription: 'Workflow test task',
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			// Read entries
			const readEntriesAdapter = new ReadJournalEntriesToolAdapter();
			const entriesResult = await readEntriesAdapter.invoke(
				{
					input: {
						includeContent: true,
						maxEntries: 10,
					},
					options: {},
				} as any,
				{} as any
			);

			// Read tasks
			const readTasksAdapter = new ReadJournalTasksToolAdapter();
			const tasksResult = await readTasksAdapter.invoke(
				{
					input: {
						date: '2025-10-30',
					},
					options: {},
				} as any,
				{} as any
			);

			const entriesParts = entriesResult.content as any[];
			const tasksParts = tasksResult.content as any[];

			assert.ok(entriesParts[0].value.includes('Workflow test entry'), 'Should include entry');
			assert.ok(tasksParts[0].value.includes('Workflow test task'), 'Should include task');
			assert.ok(tasksParts[0].value.includes('[x]'), 'Task should be completed');
			assert.ok(tasksParts[0].value.includes('1 completed'), 'Should show completed in summary');
		});
	});
});
