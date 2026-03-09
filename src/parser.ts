/**
 * AngularJS module dependency parser.
 *
 * Extracts `angular.module()` declarations (setters) and references (getters)
 * from JavaScript source code using regex-based pattern matching.
 * Comments are stripped before parsing to avoid false positives.
 *
 * @module parser
 */

/**
 * Result of parsing AngularJS module dependencies from a source file.
 */
export interface NgDependencyInfo {
  /**
   * Modules declared in this file via setter calls.
   * Keys are module names, values are arrays of dependency module names.
   *
   * @example
   * // For: angular.module('app', ['service', 'utils'])
   * // => { app: ['service', 'utils'] }
   */
  modules: Record<string, string[]>;

  /**
   * Module names this file depends on externally.
   * Includes dependencies from both setter arrays and getter references,
   * excluding modules declared in the same file and the built-in 'ng' module.
   *
   * @example
   * // For: angular.module('app', ['service']); angular.module('utils');
   * // => ['service', 'utils']
   */
  dependencies: string[];
}

/**
 * Strip JavaScript comments from source code while preserving string literals.
 *
 * Handles single-line comments (//), multi-line comments, and
 * correctly skips over string literals (single, double, and template) so that
 * comment-like content inside strings is preserved.
 *
 * @param source - Raw JavaScript source code
 * @returns Source code with all comments replaced by single spaces
 */
function stripComments(source: string): string {
  let result = "";
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    // String literals — skip through them to avoid stripping comments inside strings
    if (ch === '"' || ch === "'" || ch === "`") {
      const start = i;
      i++;
      while (i < len && source[i] !== ch) {
        if (source[i] === "\\") i++; // skip escaped characters
        i++;
      }
      i++; // closing quote
      result += source.slice(start, i);
      continue;
    }

    // Multi-line comment: /* ... */
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) {
        i++;
      }
      i += 2; // skip closing */
      result += " "; // replace with space to preserve token separation
      continue;
    }

    // Single-line comment: // ...
    if (ch === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < len && source[i] !== "\n") {
        i++;
      }
      result += " ";
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Regex to match `angular.module('name', ['dep1', 'dep2'])` or `angular.module('name')`.
 *
 * Capture groups:
 * - Group 1: Module name (single-quoted)
 * - Group 2: Module name (double-quoted)
 * - Group 3: Dependency array contents (undefined for getter calls)
 */
const ANGULAR_MODULE_RE =
  /angular\s*\.\s*module\s*\(\s*(?:'([^']+)'|"([^"]+)")\s*(?:,\s*\[([^\]]*)\])?\s*\)/g;

/** Regex to extract individual string literals from a dependency array. */
const STRING_LITERAL_RE = /(?:'([^']*)'|"([^"]*)")/g;

/**
 * Parse AngularJS module declarations and references from JavaScript source code.
 *
 * Identifies two types of `angular.module()` calls:
 * - **Setter** (declaration): `angular.module('name', ['dep1', 'dep2'])` — declares a module with dependencies
 * - **Getter** (reference): `angular.module('name')` — references an existing module (e.g., to register controllers)
 *
 * External dependencies are computed as the union of all setter dependency names
 * and getter references, minus any modules declared in the same file and the
 * built-in `'ng'` module.
 *
 * @param source - JavaScript source code to parse
 * @returns Parsed module declarations and external dependencies
 *
 * @example
 * ```ts
 * const info = parseNgDependencies("angular.module('app', ['service'])");
 * // info.modules => { app: ['service'] }
 * // info.dependencies => ['service']
 * ```
 */
export function parseNgDependencies(source: string): NgDependencyInfo {
  const cleaned = stripComments(source);
  const modules: Record<string, string[]> = {};
  const getterRefs: string[] = [];

  const re = new RegExp(ANGULAR_MODULE_RE.source, ANGULAR_MODULE_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(cleaned)) !== null) {
    const moduleName = match[1] ?? match[2];
    const depsContent = match[3];

    if (depsContent !== undefined) {
      // Setter: angular.module('name', [...]) — module declaration
      const deps: string[] = [];
      const depRe = new RegExp(STRING_LITERAL_RE.source, STRING_LITERAL_RE.flags);
      let depMatch: RegExpExecArray | null;
      while ((depMatch = depRe.exec(depsContent)) !== null) {
        deps.push(depMatch[1] ?? depMatch[2]);
      }
      modules[moduleName] = deps;
    } else {
      // Getter: angular.module('name') — module reference
      getterRefs.push(moduleName);
    }
  }

  // Compute external dependencies:
  // All deps from setter arrays + getter refs, minus self-declared modules, minus 'ng'
  const declaredModules = new Set(Object.keys(modules));
  const depSet = new Set<string>();

  // Collect deps from setter dependency arrays
  for (const deps of Object.values(modules)) {
    for (const dep of deps) {
      if (dep !== "ng" && !declaredModules.has(dep)) {
        depSet.add(dep);
      }
    }
  }

  // Collect getter references as dependencies
  for (const ref of getterRefs) {
    if (ref !== "ng" && !declaredModules.has(ref)) {
      depSet.add(ref);
    }
  }

  return { modules, dependencies: [...depSet] };
}
