/**
 * VS Code Language Model Tool adapters for Date Utility operations.
 * These adapters wrap the platform-agnostic DateUtilityToolCore and provide VS Code integration.
 */

import * as vscode from "vscode";
import { DateUtilityToolCore } from "../../../core/tools/DateUtilityToolCore";
import { dateService } from "../../../services/DateService";
import type {
	ICalculateRelativeDateParameters,
	IGetDateInfoParameters,
	IGetWeekDatesParameters,
} from "../../../core/types/DateParameters";

/**
 * VS Code adapter for calculating relative dates.
 * Converts natural language date descriptions to actual dates.
 */
export class CalculateRelativeDateToolAdapter
	implements vscode.LanguageModelTool<ICalculateRelativeDateParameters>
{
	private core: DateUtilityToolCore;

	constructor() {
		this.core = new DateUtilityToolCore(dateService);
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ICalculateRelativeDateParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const result = await this.core.calculateRelativeDate(options.input);

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(result.message),
		]);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ICalculateRelativeDateParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Calculating relative date: "${options.input.relativeDateDescription}"`,
		};
	}
}

/**
 * VS Code adapter for getting date information.
 * Retrieves comprehensive details about a specific date.
 */
export class GetDateInfoToolAdapter implements vscode.LanguageModelTool<IGetDateInfoParameters> {
	private core: DateUtilityToolCore;

	constructor() {
		this.core = new DateUtilityToolCore(dateService);
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IGetDateInfoParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const result = await this.core.getDateInfo(options.input);

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(result.message),
		]);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IGetDateInfoParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Getting information for date: ${options.input.date}`,
		};
	}
}

/**
 * VS Code adapter for getting week dates.
 * Retrieves all dates in an ISO week.
 */
export class GetWeekDatesToolAdapter implements vscode.LanguageModelTool<IGetWeekDatesParameters> {
	private core: DateUtilityToolCore;

	constructor() {
		this.core = new DateUtilityToolCore(dateService);
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IGetWeekDatesParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const result = await this.core.getWeekDates(options.input);

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(result.message),
		]);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IGetWeekDatesParameters>,
		_token: vscode.CancellationToken
	) {
		const dateInfo = options.input.date ? `for ${options.input.date}` : "for current week";
		return {
			invocationMessage: `Getting week dates ${dateInfo}`,
		};
	}
}
