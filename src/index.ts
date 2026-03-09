/**
 * vite-angular-filesort — Sort AngularJS files by module dependencies.
 *
 * A modern replacement for gulp-angular-filesort, designed for AngularJS
 * applications migrating their build tooling from Gulp to Vite.
 *
 * @packageDocumentation
 *
 * @example Vite plugin — injects sorted script tags into index.html automatically
 * ```ts
 * // vite.config.ts
 * import { angularFilesort } from 'vite-angular-filesort';
 * export default defineConfig({
 *   plugins: [angularFilesort({ scanRoot: 'src/app' })],
 * });
 * ```
 *
 * @example Programmatic usage
 * ```ts
 * import { sortAngularFiles } from 'vite-angular-filesort';
 * const sorted = await sortAngularFiles(['src/app.js', 'src/service.js']);
 * ```
 */

export { parseNgDependencies } from "./parser.ts";
export type { NgDependencyInfo } from "./parser.ts";

export { toposort, CyclicDependencyError } from "./toposort.ts";

export { sortAngularFiles, sortAngularFilesSync } from "./sort.ts";

export { angularFilesort } from "./plugin.ts";
export type { AngularFilesortPluginOptions } from "./plugin.ts";
