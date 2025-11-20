import * as path from "path";
import * as fs from "fs/promises";
import { getTemplatesFolderName, getVaultRoot } from "../extension";

/**
 * Provides simple template rendering capabilities for markdown files stored in the vault.
 * Templates are stored under the "Templates" folder at the vault root and support
 * token replacement, basic conditionals, and collection iteration.
 *
 * @remarks
 * The renderer intentionally supports a small feature set to keep templates readable
 * and deterministic:
 * - `{{token}}` replaces with the corresponding value from the provided data
 * - `{{#if token}}...{{/if}}` renders the block when the token evaluates truthy
 * - `{{#each items}}...{{/each}}` repeats the block for each element in an array
 * - `{{DATETIME.Now}}` injects the current local time, formatted as `YYYY-MM-DDTHH:mm`
 *
 * Nested loops inherit access to parent scopes, and tokens always fall back to the
 * root data object when not found in the current scope. All file reads stay within
 * the Templates directory to guard against path traversal.
 *
 * @example
 * ```typescript
 * const service = new TemplateService();
 * const content = await service.renderTemplate('journal-weekly', {
 *   weekNumber: 44,
 *   year: 2025,
 *   days: [{ dayNumber: 30, dayName: 'Thursday' }]
 * });
 * ```
 */
export class TemplateService {
  private readonly nowProvider: () => Date;

  /**
   * Creates a new TemplateService.
   *
   * @param nowProvider - Optional factory for retrieving the current date/time. Useful for testing deterministic output.
   */
  constructor(nowProvider?: () => Date) {
    this.nowProvider = nowProvider ?? (() => new Date());
  }

  /**
   * Render a template file using the supplied data.
   *
   * @param templateName - Template file name or identifier (extension optional)
   * @param data - Arbitrary data available to the template tokens
   * @returns Rendered content or null if the template file is missing or vault unavailable
   */
  async renderTemplate(
    templateName: string,
    data: Record<string, unknown>
  ): Promise<string | null> {
    const templateContent = await this.loadTemplateContent(templateName);
    if (!templateContent) {
      return null;
    }

    const rendered = this.renderContent(templateContent, [data]);
    return rendered;
  }

  private async loadTemplateContent(templateName: string): Promise<string | null> {
    const fileName = this.ensureExtension(templateName);
    const templatePath = this.resolveTemplatePath(fileName);
    if (!templatePath) {
      return null;
    }

    try {
      return await fs.readFile(templatePath, "utf-8");
    } catch {
      return null;
    }
  }

  private ensureExtension(templateName: string): string {
    if (path.extname(templateName)) {
      return templateName;
    }
    return `${templateName}.md`;
  }

  private resolveTemplatePath(fileName: string): string | null {
    const vaultRoot = getVaultRoot();
    if (!vaultRoot) {
      return null;
    }

    const templateFolder = getTemplatesFolderName();
    const templateRoot = path.join(vaultRoot, templateFolder);
    const resolvedPath = path.resolve(templateRoot, fileName);
    if (!resolvedPath.startsWith(templateRoot)) {
      return null;
    }

    return resolvedPath;
  }

  private renderContent(template: string, contextStack: unknown[]): string {
    let content = template;

    const eachRegex = /{{#each\s+([\w.]+)}}([\s\S]*?){{\/each}}/g;
    content = content.replace(eachRegex, (_match, key, block) => {
      const collection = this.resolveFromStack(key, contextStack);
      if (!Array.isArray(collection) || collection.length === 0) {
        return "";
      }

      return collection
        .map((item) => this.renderContent(block, [item, ...contextStack]))
        .join("");
    });

    const ifRegex = /{{#if\s+([\w.]+)}}([\s\S]*?){{\/if}}/g;
    content = content.replace(ifRegex, (_match, key, block) => {
      const value = this.resolveFromStack(key, contextStack);
      if (!this.isTruthy(value)) {
        return "";
      }
      return this.renderContent(block, contextStack);
    });

    const tokenRegex = /{{\s*([\w.]+)\s*}}/g;
    content = content.replace(tokenRegex, (_match, key) => {
      if (this.isDateTimeToken(key)) {
        return this.formatCurrentDateTime();
      }

      const value = this.resolveFromStack(key, contextStack);
      return this.stringifyValue(value);
    });

    return content;
  }

  private resolveFromStack(key: string, contextStack: unknown[]): unknown {
    for (const context of contextStack) {
      const lookup = this.lookupValue(context, key);
      if (lookup.found) {
        return lookup.value;
      }
    }
    return undefined;
  }

  private lookupValue(source: unknown, pathKey: string): { found: boolean; value: unknown } {
    if (source === null || typeof source !== "object") {
      return { found: false, value: undefined };
    }

    const segments = pathKey.split(".");
    let current: any = source;
    for (const segment of segments) {
      if (current === null || typeof current !== "object") {
        return { found: false, value: undefined };
      }

      if (!(segment in current)) {
        return { found: false, value: undefined };
      }

      current = current[segment];
    }

    return { found: true, value: current };
  }

  private isTruthy(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return Boolean(value);
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return "";
    }

    return String(value);
  }

  private isDateTimeToken(key: string): boolean {
    return key === "DATETIME.Now";
  }

  private formatCurrentDateTime(): string {
    const now = this.nowProvider();
    const year = now.getFullYear();
    const month = this.padNumber(now.getMonth() + 1);
    const day = this.padNumber(now.getDate());
    const hours = this.padNumber(now.getHours());
    const minutes = this.padNumber(now.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private padNumber(value: number): string {
    return value.toString().padStart(2, "0");
  }
}

export const templateService = new TemplateService();
