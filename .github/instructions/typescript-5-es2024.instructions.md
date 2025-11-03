---
description: 'Guidelines for TypeScript Development targeting TypeScript 5.x and ES2024 output'
applyTo: '**/*.ts'
---

# TypeScript Development

> These instructions assume projects are built with TypeScript 5.x (or newer) compiling to an ES2024 JavaScript baseline. Adjust guidance if your runtime requires older language targets or down-level transpilation.

## Core Intent

- Respect the existing architecture and coding standards.
- Prefer readable, explicit solutions over clever shortcuts.
- Extend current abstractions before inventing new ones.
- Prioritize maintainability and clarity, short methods and classes, clean code.

## General Guardrails

- Target TypeScript 5.x / ES2024 and prefer native features over polyfills.
- Leverage ES2024 features:
  - Use `Object.groupBy()` and `Map.groupBy()` for grouping operations
  - Use `Promise.withResolvers()` for deferred promise patterns
  - Use `Atomics.waitAsync()` for non-blocking shared memory operations
  - Use array methods like `toReversed()`, `toSorted()`, `toSpliced()`, and `with()` for immutable array operations
  - Use regex `v` flag for improved Unicode property escapes and set notation
- Use pure ES modules; never emit `require`, `module.exports`, or CommonJS helpers.
- Rely on the project's build, lint, and test scripts unless asked otherwise.
- Note design trade-offs when intent is not obvious.

## Project Organization

- Follow the repository's folder and responsibility layout for new code.
- Use kebab-case filenames (e.g., `user-session.ts`, `data-service.ts`) unless told otherwise.
- Keep tests, types, and helpers near their implementation when it aids discovery.
- Reuse or extend shared utilities before adding new ones.

## Naming & Style

- Use PascalCase for classes, interfaces, enums, and type aliases; camelCase for everything else.
- Skip interface prefixes like `I`; rely on descriptive names.
- Name things for their behavior or domain meaning, not implementation.

## Formatting & Style

- Run the repository's lint/format scripts (e.g., `npm run lint`) before submitting.
- Match the project's indentation, quote style, and trailing comma rules.
- Keep functions focused; extract helpers when logic branches grow.
- Favor immutable data and pure functions when practical.
- Prefer immutable array methods (`toSorted()`, `toReversed()`, `toSpliced()`, `with()`) over mutating equivalents when copying is acceptable.
- Use `Object.groupBy()` or `Map.groupBy()` instead of manual grouping logic.

## Type System Expectations

- Avoid `any` (implicit or explicit); prefer `unknown` plus narrowing.
- Use discriminated unions for realtime events and state machines.
- Centralize shared contracts instead of duplicating shapes.
- Express intent with TypeScript utility types (e.g., `Readonly`, `Partial`, `Record`, `NoInfer`, `Awaited`).
- Leverage TypeScript 5.x features:
  - Use `const` type parameters for better literal type inference
  - Use `satisfies` operator to validate types while preserving literal types
  - Use explicit type annotations with `NoInfer` to prevent unwanted type widening
  - Use decorators with the standardized ECMAScript decorator proposal syntax

## Async, Events & Error Handling

- Use `async/await`; wrap awaits in try/catch with structured errors.
- Use `Promise.withResolvers()` for deferred promise patterns instead of manual executor functions.
- Guard edge cases early to avoid deep nesting.
- Send errors through the project's logging/telemetry utilities.
- Surface user-facing errors via the repository's notification pattern.
- Debounce configuration-driven updates and dispose resources deterministically.
- Consider using `AbortSignal.timeout()` for time-limited operations.
- Chain promises with proper error propagation; avoid unhandled rejections.

## Architecture & Patterns

- Follow the repository's dependency injection or composition pattern; keep modules single-purpose.
- Observe existing initialization and disposal sequences when wiring into lifecycles.
- Keep transport, domain, and presentation layers decoupled with clear interfaces.
- Supply lifecycle hooks (e.g., `initialize`, `dispose`) and targeted tests when adding services.

## External Integrations

- Instantiate clients outside hot paths and inject them for testability.
- Never hardcode secrets; load them from secure sources.
- Apply retries, backoff, and cancellation to network or IO calls.
- Normalize external responses and map errors to domain shapes.

## Security Practices

- Validate and sanitize external input with schema validators or type guards.
- Avoid dynamic code execution and untrusted template rendering.
- Encode untrusted content before rendering HTML; use framework escaping or trusted types.
- Use parameterized queries or prepared statements to block injection.
- Keep secrets in secure storage, rotate them regularly, and request least-privilege scopes.
- Favor immutable flows and defensive copies for sensitive data.
- Use vetted crypto libraries only.
- Patch dependencies promptly and monitor advisories.

## Configuration & Secrets

- Reach configuration through shared helpers and validate with schemas or dedicated validators.
- Handle secrets via the project's secure storage; guard `undefined` and error states.
- Document new configuration keys and update related tests.

## UI & UX Components

- Sanitize user or external content before rendering.
- Keep UI layers thin; push heavy logic to services or state managers.
- Use messaging or events to decouple UI from business logic.

## Testing Expectations

- Add or update unit tests with the project's framework and naming style.
- Expand integration or end-to-end suites when behavior crosses modules or platform APIs.
- Run targeted test scripts for quick feedback before submitting.
- Avoid brittle timing assertions; prefer fake timers or injected clocks.

## Performance & Reliability

- Lazy-load heavy dependencies and dispose them when done.
- Defer expensive work until users need it.
- Batch or debounce high-frequency events to reduce thrash.
- Track resource lifetimes to prevent leaks.
- Use immutable array methods (`toSorted()`, `toReversed()`) when the performance trade-off is acceptable.
- For large datasets, prefer mutating methods (`sort()`, `reverse()`) to avoid unnecessary copying.
- Use `Object.groupBy()` or `Map.groupBy()` for efficient grouping operations.
- Consider `structuredClone()` for deep cloning over manual or library-based approaches.

## Documentation & Comments

- **Add comprehensive JSDoc to all public APIs, classes, interfaces, and complex functions**
- Include `@param`, `@returns`, `@remarks`, and `@example` tags as appropriate
- Write comments that capture intent, and remove stale notes during refactors
- Update architecture or design docs when introducing significant patterns
- Document security considerations (input validation, path traversal prevention, etc.)
- Explain performance implications for recursive operations or large data processing
- Use `@remarks` for non-obvious behavior, edge cases, or important context
- Include `@example` blocks showing typical usage patterns for complex functions
- Document all interface properties with inline comments describing their purpose
- Keep documentation synchronized with code changes