import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { TemplateService } from '../services/TemplateService';
import { setTemplatesFolderNameForTesting, setVaultRootForTesting } from '../extension';

suite('TemplateService', () => {
  let testWorkspaceRoot: string;
  let templatesDir: string;
  let service: TemplateService;

  async function createTestWorkspace(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-service-'));
    await fs.mkdir(path.join(dir, '.obsidian'));
    return dir;
  }

  async function cleanupWorkspace(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
  }

  setup(async () => {
    testWorkspaceRoot = await createTestWorkspace();
    templatesDir = path.join(testWorkspaceRoot, 'Templates');
    await fs.mkdir(templatesDir, { recursive: true });
    setVaultRootForTesting(testWorkspaceRoot);
    setTemplatesFolderNameForTesting(null);
    service = new TemplateService();
  });

  teardown(async () => {
    setVaultRootForTesting(null);
    setTemplatesFolderNameForTesting(null);
    await cleanupWorkspace(testWorkspaceRoot);
  });

  test('renderTemplate should replace tokens and loops', async () => {
    const templatePath = path.join(templatesDir, 'weekly-journal.md');
    const templateContent = [
      '# Week {{weekNumber}} in {{year}}',
      '',
      '{{#each days}}',
      '## {{dayNumber}} {{dayName}}',
      '{{/each}}'
    ].join('\n');
    await fs.writeFile(templatePath, templateContent, 'utf-8');

    const rendered = await service.renderTemplate('weekly-journal.md', {
      year: 2025,
      weekNumber: 44,
      days: [
        { dayNumber: 17, dayName: 'Monday' },
        { dayNumber: 18, dayName: 'Tuesday' }
      ]
    });

    assert.ok(rendered);
    assert.ok(rendered?.includes('# Week 44 in 2025'));
    assert.ok(rendered?.includes('## 17 Monday'));
    assert.ok(rendered?.includes('## 18 Tuesday'));
  });

  test('renderTemplate should support basic conditional blocks', async () => {
    const templatePath = path.join(templatesDir, 'summary.md');
    const templateContent = [
      '{{#if summary}}Summary: {{summary}}{{/if}}',
      '{{#if footer}}Footer: {{footer}}{{/if}}'
    ].join('\n');
    await fs.writeFile(templatePath, templateContent, 'utf-8');

    const rendered = await service.renderTemplate('summary', {
      summary: 'All done!'
    });

    assert.ok(rendered?.includes('Summary: All done!'));
    assert.ok(!rendered?.includes('Footer:'));
  });

  test('renderTemplate should return null when template missing', async () => {
    const rendered = await service.renderTemplate('does-not-exist.md', {});
    assert.strictEqual(rendered, null);
  });

  test('renderTemplate should honor custom templates folder setting', async () => {
    const customDir = path.join(testWorkspaceRoot, 'CustomTemplates');
    await fs.mkdir(customDir, { recursive: true });
    setTemplatesFolderNameForTesting('CustomTemplates');

    const templatePath = path.join(customDir, 'note.md');
    await fs.writeFile(templatePath, 'Hello {{name}}', 'utf-8');

    const rendered = await service.renderTemplate('note', { name: 'Vault' });
    assert.strictEqual(rendered, 'Hello Vault');
  });

  test('renderTemplate should replace DATETIME.Now with formatted timestamp', async () => {
    const templatePath = path.join(templatesDir, 'timestamp.md');
    await fs.writeFile(templatePath, 'Generated at {{DATETIME.Now}}', 'utf-8');

    const fixedTimestamp = new Date(2025, 10, 18, 7, 52, 0); // Months are 0-based
    const deterministicService = new TemplateService(() => fixedTimestamp);

    const rendered = await deterministicService.renderTemplate('timestamp', {});
    assert.strictEqual(rendered, 'Generated at 2025-11-18T07:52');
  });
});
