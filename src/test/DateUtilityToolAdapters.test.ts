import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	CalculateRelativeDateToolAdapter,
	GetDateInfoToolAdapter,
	GetWeekDatesToolAdapter,
} from '../adapters/vscode/tools/DateUtilityToolAdapters';

suite('Date Utility Tool Adapters Test Suite', () => {
	suite('CalculateRelativeDateToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should calculate "yesterday" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'yesterday',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-11-25');
			assert.strictEqual(response.referenceDate, '2025-11-26');
			assert.strictEqual(response.daysFromReference, -1);
		});

		test('should calculate "tomorrow" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'tomorrow',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-11-27');
			assert.strictEqual(response.daysFromReference, 1);
		});

		test('should calculate "today" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'today',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-11-26');
			assert.strictEqual(response.daysFromReference, 0);
		});

		test('should calculate "last Wednesday" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			// 2025-11-26 is a Wednesday
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'last Wednesday',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-11-19'); // Previous Wednesday
			assert.strictEqual(response.calculatedDayOfWeek, 'Wednesday');
		});

		test('should calculate "next Monday" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			// 2025-11-26 is a Wednesday
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'next Monday',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-12-01'); // Next Monday
			assert.strictEqual(response.calculatedDayOfWeek, 'Monday');
		});

		test('should calculate "2 days ago" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: '2 days ago',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-11-24');
			assert.strictEqual(response.daysFromReference, -2);
		});

		test('should calculate "1 week ago" correctly', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: '1 week ago',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.calculatedDate, '2025-11-19');
			assert.strictEqual(response.daysFromReference, -7);
		});

		test('should return error for invalid description', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'invalid description',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, false);
			assert.ok(response.error);
			assert.ok(response.hint);
		});

		test('should use today as reference when not specified', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'today',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(response.calculatedDate);
			assert.ok(response.referenceDate);
		});

		test('should include ISO week information', async () => {
			const adapter = new CalculateRelativeDateToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						relativeDateDescription: 'yesterday',
						referenceDate: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(response.isoWeek !== undefined);
			assert.ok(response.isoYear !== undefined);
		});
	});

	suite('GetDateInfoToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new GetDateInfoToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should get date info for valid date', async () => {
			const adapter = new GetDateInfoToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.date, '2025-11-26');
			assert.strictEqual(response.dayOfWeek, 'Wednesday');
			assert.strictEqual(response.dayOfMonth, 26);
			assert.strictEqual(response.month, 'November');
			assert.strictEqual(response.year, 2025);
		});

		test('should include ISO week information', async () => {
			const adapter = new GetDateInfoToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(response.isoWeek !== undefined);
			assert.ok(response.isoYear !== undefined);
		});

		test('should include day of year', async () => {
			const adapter = new GetDateInfoToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-01-01',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.dayOfYear, 1);
		});

		test('should include relative description to today', async () => {
			const adapter = new GetDateInfoToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(response.relativeToToday);
			assert.ok(response.daysFromToday !== undefined);
			assert.ok(response.today);
		});

		test('should return error for invalid date format', async () => {
			const adapter = new GetDateInfoToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: 'invalid-date',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, false);
			assert.ok(response.error);
			assert.ok(response.error.includes('Invalid date format'));
		});

		test('should handle leap year dates', async () => {
			const adapter = new GetDateInfoToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2024-02-29',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.date, '2024-02-29');
			assert.strictEqual(response.dayOfMonth, 29);
			assert.strictEqual(response.month, 'February');
		});
	});

	suite('GetWeekDatesToolAdapter', () => {
		test('should create instance without errors', () => {
			const adapter = new GetWeekDatesToolAdapter();
			assert.ok(adapter, 'Adapter should be created');
		});

		test('should get week dates for specified date', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(response.isoWeek !== undefined);
			assert.ok(response.isoYear !== undefined);
			assert.ok(response.weekDescription);
			assert.ok(Array.isArray(response.dates));
			assert.strictEqual(response.dates.length, 7);
		});

		test('should return Monday through Sunday', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.dates[0].dayOfWeek, 'Monday');
			assert.strictEqual(response.dates[6].dayOfWeek, 'Sunday');
		});

		test('should include all date properties', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			const firstDay = response.dates[0];
			assert.ok(firstDay.date);
			assert.ok(firstDay.dayOfWeek);
			assert.ok(firstDay.dayNumber !== undefined);
			assert.ok(firstDay.isToday !== undefined);
		});

		test('should use current week when date not specified', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			const result = await adapter.invoke(
				{
					input: {},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(Array.isArray(response.dates));
			assert.strictEqual(response.dates.length, 7);
		});

		test('should correctly identify today in week dates', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const todayStr = today.toISOString().split('T')[0];

			const result = await adapter.invoke(
				{
					input: {
						date: todayStr,
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			const todayEntry = response.dates.find((d: any) => d.isToday);
			assert.ok(todayEntry, 'Should find today in the week dates');
		});

		test('should handle week spanning month boundary', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			// Week that spans from one month to another
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-30', // Sunday
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.dates.length, 7);
			// Verify we have dates from both November and December
			const dates = response.dates.map((d: any) => d.date);
			assert.ok(dates.some((d: string) => d.startsWith('2025-11')));
		});

		test('should handle week spanning year boundary', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			// Week that spans from one year to another
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-12-31', // Wednesday
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.strictEqual(response.dates.length, 7);
			// Verify we have dates from both 2025 and 2026
			const dates = response.dates.map((d: any) => d.date);
			assert.ok(dates.some((d: string) => d.startsWith('2025-')));
			assert.ok(dates.some((d: string) => d.startsWith('2026-')));
		});

		test('should format week description correctly', async () => {
			const adapter = new GetWeekDatesToolAdapter();
			const result = await adapter.invoke(
				{
					input: {
						date: '2025-11-26',
					},
					options: {},
				} as any,
				{} as vscode.CancellationToken
			);

			const parts = result.content as vscode.LanguageModelTextPart[];
			const response = JSON.parse(parts[0].value);

			assert.strictEqual(response.success, true);
			assert.ok(response.weekDescription.includes('Week'));
			assert.ok(response.weekDescription.includes('of'));
		});
	});
});
