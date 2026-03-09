/**
 * High-level sorting functions for AngularJS source files.
 *
 * Combines the parser and topological sort to provide ready-to-use functions
 * that accept file paths (or pre-read contents) and return them in dependency order.
 *
 * @module sort
 */

import { readFile } from "node:fs/promises";
import { parseNgDependencies } from "./parser.ts";
import { toposort } from "./toposort.ts";
import type { NgDependencyInfo } from "./parser.ts";

/** A file with its parsed AngularJS dependency information. */
interface ParsedFile {
  /** Absolute or relative file path */
  filePath: string;
  /** Parsed AngularJS module declarations and dependencies */
  ngDeps: NgDependencyInfo;
}

/**
 * Sort AngularJS source files by module dependencies.
 *
 * Reads each file from disk, parses `angular.module()` calls, builds a
 * dependency graph between files, and returns file paths in topological order
 * (dependencies first, dependents last).
 *
 * Dependencies on modules not declared in any of the provided files
 * (e.g., third-party modules like `ui.router`) are silently ignored.
 *
 * @param filePaths - Absolute paths to JavaScript files to sort
 * @returns File paths sorted in dependency order
 * @throws {CyclicDependencyError} When circular dependencies are detected between files
 *
 * @example
 * ```ts
 * const sorted = await sortAngularFiles([
 *   '/app/app.module.js',      // angular.module('app', ['shared'])
 *   '/app/shared.module.js',   // angular.module('shared', [])
 * ]);
 * // => ['/app/shared.module.js', '/app/app.module.js']
 * ```
 */
export async function sortAngularFiles(filePaths: string[]): Promise<string[]> {
  const parsed: ParsedFile[] = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readFile(filePath, "utf-8");
      return { filePath, ngDeps: parseNgDependencies(content) };
    }),
  );

  return sortParsedFiles(parsed);
}

/**
 * Sort AngularJS source files by module dependencies (synchronous variant).
 *
 * Same algorithm as {@link sortAngularFiles}, but accepts pre-read file contents
 * instead of reading from disk. Useful when file contents are already in memory
 * (e.g., from a build pipeline or test fixture).
 *
 * @param files - Array of objects with `filePath` and `content` properties
 * @returns File paths sorted in dependency order
 * @throws {CyclicDependencyError} When circular dependencies are detected between files
 *
 * @example
 * ```ts
 * const sorted = sortAngularFilesSync([
 *   { filePath: 'app.js', content: "angular.module('app', ['svc'])" },
 *   { filePath: 'svc.js', content: "angular.module('svc', [])" },
 * ]);
 * // => ['svc.js', 'app.js']
 * ```
 */
export function sortAngularFilesSync(files: { filePath: string; content: string }[]): string[] {
  const parsed = files.map(({ filePath, content }) => ({
    filePath,
    ngDeps: parseNgDependencies(content),
  }));

  return sortParsedFiles(parsed);
}

/**
 * Core sorting logic shared by async and sync variants.
 *
 * Builds a dependency graph between files by:
 * 1. Mapping each declared module name to the file that declares it
 * 2. Creating directed edges from each file to the files that declare its dependencies
 * 3. Running topological sort on the resulting graph
 *
 * @param files - Parsed files with their AngularJS dependency information
 * @returns File paths in topological dependency order
 */
function sortParsedFiles(files: ParsedFile[]): string[] {
  // Map each module name to the file that declares it
  const moduleToFile = new Map<string, string>();
  for (const { filePath, ngDeps } of files) {
    for (const moduleName of Object.keys(ngDeps.modules)) {
      moduleToFile.set(moduleName, filePath);
    }
  }

  // Build directed edges: [dependent file, dependency file]
  // Only create edges for modules that are actually declared in the file set
  const edges: [string, string][] = [];
  for (const { filePath, ngDeps } of files) {
    for (const dep of ngDeps.dependencies) {
      const depFile = moduleToFile.get(dep);
      if (depFile && depFile !== filePath) {
        edges.push([filePath, depFile]);
      }
    }
  }

  return toposort(
    files.map((f) => f.filePath),
    edges,
  );
}
