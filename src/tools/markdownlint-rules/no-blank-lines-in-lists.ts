/**
 * Custom markdownlint rule: no-blank-lines-in-lists
 * 
 * This rule removes blank lines between consecutive list items to keep them
 * as a single continuous list. This is useful for journal entries where we
 * want all entries under a day heading to be formatted as one compact list.
 */
export const noBlankLinesInLists = {
  names: ["no-blank-lines-in-lists"],
  description: "Remove blank lines between list items in the same list",
  tags: ["lists", "whitespace"],
  parser: "none" as const,
  function: (params: any, onError: any) => {
    const { lines } = params;

    // Scan through all lines looking for list items followed by blank lines
    // We need to look ahead to find the next list item (skipping any blank lines)
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];

      // Check if current line is a list item
      if (currentLine && currentLine.trim().match(/^[-*+]\s+/)) {
        // Find the next non-blank line
        let nextNonBlankIndex = i + 1;
        while (nextNonBlankIndex < lines.length && lines[nextNonBlankIndex].trim() === "") {
          nextNonBlankIndex++;
        }

        // Check if the next non-blank line is also a list item
        if (nextNonBlankIndex < lines.length && lines[nextNonBlankIndex].trim().match(/^[-*+]\s+/)) {
          // Report all blank lines between the two list items
          for (let blankIndex = i + 1; blankIndex < nextNonBlankIndex; blankIndex++) {
            onError({
              lineNumber: blankIndex + 1, // Line number (1-based)
              detail: "Blank line between list items",
              context: `Between "${currentLine.trim()}" and "${lines[nextNonBlankIndex].trim()}"`,
              fixInfo: {
                lineNumber: blankIndex + 1, // The blank line to delete (1-based)
                deleteCount: -1, // Delete the entire line
              },
            });
          }
        }
      }
    }
  },
};
