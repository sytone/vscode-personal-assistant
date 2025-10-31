import * as assert from 'assert';
import { noBlankLinesInLists } from '../tools/markdownlint-rules/no-blank-lines-in-lists';

suite('Custom Markdownlint Rules', () => {
  suite('no-blank-lines-in-lists', () => {
    test('should have correct metadata', () => {
      assert.deepStrictEqual(noBlankLinesInLists.names, ['no-blank-lines-in-lists']);
      assert.strictEqual(noBlankLinesInLists.description, 'Remove blank lines between list items in the same list');
      assert.deepStrictEqual(noBlankLinesInLists.tags, ['lists', 'whitespace']);
      assert.strictEqual(noBlankLinesInLists.parser, 'none');
    });

    test('should detect blank lines between list items', async () => {
      // Dynamically import markdownlint modules
      const [{ lint }, { applyFixes }] = await Promise.all([
        import('markdownlint/async'),
        import('markdownlint')
      ]);

      const testContent = `## Heading

- First item

- Second item

- Third item
`;

      const options: any = {
        strings: {
          content: testContent,
        },
        customRules: [noBlankLinesInLists],
        config: {
          default: false,
          'no-blank-lines-in-lists': true,
        },
      };

      return new Promise<void>((resolve, reject) => {
        lint(options, (err: unknown, results?: any) => {
          if (err) {
            reject(err);
            return;
          }

          const errors = results?.content || [];
          
          // Should detect 2 blank lines (one between First and Second, one between Second and Third)
          assert.strictEqual(errors.length, 2, 'Should detect 2 blank lines between list items');
          
          // Verify fix info is present
          assert.ok(errors[0].fixInfo, 'First error should have fixInfo');
          assert.strictEqual(errors[0].fixInfo.deleteCount, -1, 'Fix should delete entire line');
          
          resolve();
        });
      });
    });

    test('should remove multiple blank lines between list items', async () => {
      // Dynamically import markdownlint modules
      const [{ lint }, { applyFixes }] = await Promise.all([
        import('markdownlint/async'),
        import('markdownlint')
      ]);

      const testContent = `## Heading

- item1
- item2

- item3
- item4


- item5
- item6
`;

      const expectedOutput = `## Heading

- item1
- item2
- item3
- item4
- item5
- item6
`;

      const options: any = {
        strings: {
          content: testContent,
        },
        customRules: [noBlankLinesInLists],
        config: {
          default: false,
          'no-blank-lines-in-lists': true,
        },
      };

      return new Promise<void>((resolve, reject) => {
        lint(options, (err: unknown, results?: any) => {
          if (err) {
            reject(err);
            return;
          }

          const errors = results?.content || [];
          
          // Apply fixes
          const fixedContent = applyFixes(testContent, errors);
          
          // Verify the output matches expected
          assert.strictEqual(fixedContent, expectedOutput, 'Should remove all blank lines between list items');
          
          resolve();
        });
      });
    });
  });
});
