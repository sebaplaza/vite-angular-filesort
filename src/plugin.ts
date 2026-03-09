/**
 * Vite plugin for sorting AngularJS source files by module dependencies.
 *
 * Scans a directory for JavaScript files, parses `angular.module()` calls,
 * and injects sorted `<script>` tags into `index.html` via the
 * `transformIndexHtml` hook — no special imports needed.
 *
 * @module plugin
 */

import { resolve, relative } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { parseNgDependencies } from "./parser.ts";
import { toposort } from "./toposort.ts";
import type { Plugin, ResolvedConfig } from "vite";

/**
 * Configuration options for the angularFilesort Vite plugin.
 */
export interface AngularFilesortPluginOptions {
  /**
   * Glob patterns for files to include in the sort.
   * @default `['** /*.js']`
   */
  include?: string[];

  /**
   * Glob patterns for files to exclude from the sort.
   * @default `['node_modules/**', 'bower_components/**', '** /*.spec.js', '** /*.test.js']`
   */
  exclude?: string[];

  /**
   * Root directory to scan for AngularJS files, relative to the Vite project root.
   * @default 'src'
   */
  scanRoot?: string;
}

/**
 * Create a Vite plugin that sorts AngularJS source files by module dependencies.
 *
 * The plugin hooks into `transformIndexHtml` to automatically inject `<script>`
 * tags for all AngularJS files in the configured scan directory, sorted so that
 * module declarations appear before files that depend on them.
 *
 * During development, the plugin re-scans and re-sorts on every HTML request
 * so changes are picked up immediately.
 *
 * @param options - Plugin configuration options
 * @returns A Vite plugin instance
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { angularFilesort } from 'vite-angular-filesort';
 *
 * export default defineConfig({
 *   plugins: [
 *     angularFilesort({ scanRoot: 'src/app' }),
 *   ],
 * });
 * ```
 */
export function angularFilesort(options: AngularFilesortPluginOptions = {}): Plugin {
  let config: ResolvedConfig;

  const {
    include = ["**/*.js"],
    exclude = ["node_modules/**", "bower_components/**", "**/*.spec.js", "**/*.test.js"],
    scanRoot = "src",
  } = options;

  /**
   * Scan the configured directory for JS files, parse their AngularJS module
   * declarations, and return file paths sorted in dependency order.
   *
   * @param root - The Vite project root directory
   * @returns Absolute file paths sorted in dependency order
   */
  async function scanAndSort(root: string): Promise<string[]> {
    const scanDir = resolve(root, scanRoot);
    const files = await collectFiles(scanDir, include, exclude);

    // Parse all files for angular.module() calls
    const parsed = await Promise.all(
      files.map(async (filePath) => {
        const content = await readFile(filePath, "utf-8");
        return { filePath, ngDeps: parseNgDependencies(content) };
      }),
    );

    // Map each declared module name to its file
    const moduleToFile = new Map<string, string>();
    for (const { filePath, ngDeps } of parsed) {
      for (const moduleName of Object.keys(ngDeps.modules)) {
        moduleToFile.set(moduleName, filePath);
      }
    }

    // Build file-to-file dependency edges
    const edges: [string, string][] = [];
    for (const { filePath, ngDeps } of parsed) {
      for (const dep of ngDeps.dependencies) {
        const depFile = moduleToFile.get(dep);
        if (depFile && depFile !== filePath) {
          edges.push([filePath, depFile]);
        }
      }
    }

    return toposort(
      parsed.map((f) => f.filePath),
      edges,
    );
  }

  return {
    name: "vite-angular-filesort",

    /** Store the resolved Vite config for access to project root. */
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    /**
     * Inject sorted `<script>` tags into `index.html`.
     * Runs on every HTML request so file changes are picked up automatically.
     */
    transformIndexHtml: {
      order: "pre",
      async handler() {
        const sortedFiles = await scanAndSort(config.root);

        return sortedFiles.map((f) => {
          const src = "/" + relative(config.root, f).split("\\").join("/");
          return {
            tag: "script",
            attrs: { src },
            injectTo: "body" as const,
          };
        });
      },
    },
  };
}

/**
 * Collect all files from a directory tree, filtered by include/exclude glob patterns.
 *
 * @param dir - Root directory to scan recursively
 * @param include - Glob patterns that files must match to be included
 * @param exclude - Glob patterns that cause files to be excluded
 * @returns Absolute paths of matching files
 */
async function collectFiles(dir: string, include: string[], exclude: string[]): Promise<string[]> {
  const files: string[] = [];
  await walkDir(dir, files);

  return files.filter((f) => {
    const rel = relative(dir, f).split("\\").join("/");
    const included = include.some((p) => matchGlob(rel, p));
    const excluded = exclude.some((p) => matchGlob(rel, p));
    return included && !excluded;
  });
}

/**
 * Recursively walk a directory tree, collecting all file paths.
 *
 * @param dir - Directory to walk
 * @param files - Accumulator array for discovered file paths
 */
async function walkDir(dir: string, files: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // Directory doesn't exist or isn't readable
  }

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
}

/**
 * Simple glob pattern matcher supporting `*` and `**` wildcards.
 *
 * - Single `*` matches any characters within a single path segment (no slashes)
 * - Double `**` matches any number of path segments (including zero)
 * - Double star followed by slash matches zero or more directories
 *
 * Built as a single-pass pattern-to-regex converter to avoid replacement conflicts
 * between wildcard tokens.
 *
 * @param filePath - The file path to test (should use forward slashes)
 * @param pattern - The glob pattern to match against
 * @returns Whether the file path matches the pattern
 */
function matchGlob(filePath: string, pattern: string): boolean {
  const specialChars = new Set(".+^${}()|[]\\");
  let regex = "";
  let i = 0;

  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        // **/ — match zero or more directory levels
        regex += "(?:.*/)?";
        i += 3;
      } else {
        // ** at end — match anything
        regex += ".*";
        i += 2;
      }
    } else if (pattern[i] === "*") {
      // * — match within a single path segment
      regex += "[^/]*";
      i++;
    } else if (specialChars.has(pattern[i])) {
      // Escape regex special characters
      regex += "\\" + pattern[i];
      i++;
    } else {
      regex += pattern[i];
      i++;
    }
  }

  return new RegExp(`^${regex}$`).test(filePath);
}

/** @internal Exported for testing only. */
export { matchGlob as _matchGlob };
