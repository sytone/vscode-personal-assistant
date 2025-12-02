/**
 * Date Utility Tools - Legacy Exports
 * 
 * @deprecated This file contains re-exports for backward compatibility.
 * The actual implementations have been moved to the adapter pattern:
 * - Core logic: src/core/tools/DateUtilityToolCore.ts
 * - VS Code adapters: src/adapters/vscode/tools/DateUtilityToolAdapters.ts
 * 
 * New code should import from the adapter files directly.
 */

export {
	CalculateRelativeDateToolAdapter as CalculateRelativeDateTool,
	GetDateInfoToolAdapter as GetDateInfoTool,
	GetWeekDatesToolAdapter as GetWeekDatesTool,
} from "../adapters/vscode/tools/DateUtilityToolAdapters";

export type {
	ICalculateRelativeDateParameters,
	IGetDateInfoParameters,
	IGetWeekDatesParameters,
} from "../core/types/DateParameters";
