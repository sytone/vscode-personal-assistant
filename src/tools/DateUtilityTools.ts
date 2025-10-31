import * as vscode from "vscode";
import { dateService } from "../services/DateService";

/**
 * Tools for date calculations and conversions to help with accurate date handling
 * in journal entries and other date-sensitive operations.
 */

// ===== TOOL CLASSES =====

interface ICalculateRelativeDateParameters {
  relativeDateDescription: string;
  referenceDate?: string;
}

export class CalculateRelativeDateTool implements vscode.LanguageModelTool<ICalculateRelativeDateParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ICalculateRelativeDateParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    let reference = new Date();
    reference.setHours(0, 0, 0, 0);

    if (params.referenceDate) {
      const parsed = dateService.parseLocalDate(params.referenceDate);
      if (parsed) {
        reference = parsed;
      }
    }

    const description = params.relativeDateDescription.toLowerCase().trim();
    let calculatedDate: Date | null = null;

    try {
      // Handle specific keywords
      if (description === "today") {
        calculatedDate = reference;
      } else if (description === "yesterday") {
        calculatedDate = new Date(reference);
        calculatedDate.setDate(calculatedDate.getDate() - 1);
      } else if (description === "tomorrow") {
        calculatedDate = new Date(reference);
        calculatedDate.setDate(calculatedDate.getDate() + 1);
      }
      // Handle "last/previous [day of week]"
      else if (description.startsWith("last ") || description.startsWith("previous ")) {
        const dayName = description.replace("last ", "").replace("previous ", "").trim();
        calculatedDate = dateService.getLastDayOfWeek(reference, dayName);
      }
      // Handle "next [day of week]"
      else if (description.startsWith("next ")) {
        const dayName = description.replace("next ", "").trim();
        calculatedDate = dateService.getNextDayOfWeek(reference, dayName);
      }
      // Handle "X days ago"
      else if (description.includes("days ago") || description.includes("day ago")) {
        const match = description.match(/(\d+)\s+days?\s+ago/);
        if (match) {
          const days = parseInt(match[1]);
          calculatedDate = new Date(reference);
          calculatedDate.setDate(calculatedDate.getDate() - days);
        }
      }
      // Handle "X weeks ago"
      else if (description.includes("weeks ago") || description.includes("week ago")) {
        const match = description.match(/(\d+)\s+weeks?\s+ago/);
        if (match) {
          const weeks = parseInt(match[1]);
          calculatedDate = new Date(reference);
          calculatedDate.setDate(calculatedDate.getDate() - weeks * 7);
        }
      }

      if (calculatedDate) {
        const isoWeek = dateService.getISOWeek(calculatedDate);
        const daysFromReference = Math.floor((calculatedDate.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24));

        const result = {
          success: true,
          inputDescription: params.relativeDateDescription,
          referenceDate: dateService.formatDate(reference),
          referenceDayOfWeek: reference.toLocaleDateString("en-US", { weekday: "long" }),
          calculatedDate: dateService.formatDate(calculatedDate),
          calculatedDayOfWeek: calculatedDate.toLocaleDateString("en-US", { weekday: "long" }),
          daysFromReference,
          isoWeek: isoWeek.week,
          isoYear: isoWeek.year,
        };

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
        ]);
      }

      const errorResult = {
        success: false,
        error: `Could not parse relative date description: '${params.relativeDateDescription}'`,
        hint: "Try formats like 'last Wednesday', 'next Monday', 'yesterday', '2 days ago', 'three weeks ago'",
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(errorResult, null, 2)),
      ]);
    } catch (err) {
      const errorResult = {
        success: false,
        error: `Error calculating date: ${err}`,
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(errorResult, null, 2)),
      ]);
    }
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

interface IGetDateInfoParameters {
  date: string;
}

export class GetDateInfoTool implements vscode.LanguageModelTool<IGetDateInfoParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IGetDateInfoParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    const targetDate = dateService.parseLocalDate(params.date);
    if (!targetDate) {
      const errorResult = {
        success: false,
        error: `Invalid date format: '${params.date}'. Use YYYY-MM-DD format.`,
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(errorResult, null, 2)),
      ]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDifference = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let relativeDescription: string;
    if (daysDifference === 0) {
      relativeDescription = "today";
    } else if (daysDifference === 1) {
      relativeDescription = "tomorrow";
    } else if (daysDifference === -1) {
      relativeDescription = "yesterday";
    } else if (daysDifference > 0) {
      relativeDescription = `in ${daysDifference} days`;
    } else {
      relativeDescription = `${Math.abs(daysDifference)} days ago`;
    }

    const isoWeek = dateService.getISOWeek(targetDate);
    const dayOfYear = Math.floor((targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));

    const result = {
      success: true,
      date: dateService.formatDate(targetDate),
      dayOfWeek: targetDate.toLocaleDateString("en-US", { weekday: "long" }),
      dayOfMonth: targetDate.getDate(),
      month: targetDate.toLocaleDateString("en-US", { month: "long" }),
      year: targetDate.getFullYear(),
      isoWeek: isoWeek.week,
      isoYear: isoWeek.year,
      dayOfYear,
      relativeToToday: relativeDescription,
      daysFromToday: daysDifference,
      today: dateService.formatDate(today),
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
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

interface IGetWeekDatesParameters {
  date?: string;
}

export class GetWeekDatesTool implements vscode.LanguageModelTool<IGetWeekDatesParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IGetWeekDatesParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    let targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);

    if (params.date) {
      const parsed = dateService.parseLocalDate(params.date);
      if (parsed) {
        targetDate = parsed;
      }
    }

    const isoWeek = dateService.getISOWeek(targetDate);

    // Get Monday of the ISO week
    const simple = new Date(isoWeek.year, 0, 1 + (isoWeek.week - 1) * 7);
    const dow = simple.getDay();
    const monday = new Date(simple);
    if (dow <= 4) {
      monday.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      monday.setDate(simple.getDate() + 8 - simple.getDay());
    }

    const weekDates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(day.getDate() + i);
      
      weekDates.push({
        date: dateService.formatDate(day),
        dayOfWeek: day.toLocaleDateString("en-US", { weekday: "long" }),
        dayNumber: day.getDate(),
        isToday: day.getTime() === today.getTime(),
      });
    }

    const result = {
      success: true,
      isoWeek: isoWeek.week,
      isoYear: isoWeek.year,
      weekDescription: `Week ${isoWeek.week} of ${isoWeek.year}`,
      dates: weekDates,
    };

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
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
