import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { angularFilesort } from "../plugin.ts";
import { _matchGlob } from "../plugin.ts";
import type { ResolvedConfig } from "vite";

describe("angularFilesort plugin", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "vite-afs-"));
    const srcDir = join(tmpDir, "src");
    const subDir = join(srcDir, "shared");
    await mkdir(subDir, { recursive: true });

    await writeFile(join(srcDir, "app.js"), "angular.module('app', ['shared', 'ngRoute'])");
    await writeFile(join(subDir, "shared.js"), "angular.module('shared', [])");
    // A spec file that should be excluded
    await writeFile(join(srcDir, "app.spec.js"), "angular.module('test', [])");
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it("returns a plugin with the correct name", () => {
    const plugin = angularFilesort();
    expect(plugin.name).toBe("vite-angular-filesort");
  });

  it("has a transformIndexHtml hook", () => {
    const plugin = angularFilesort();
    expect(plugin.transformIndexHtml).toBeDefined();
  });

  it("configResolved stores the config", () => {
    const plugin = angularFilesort();
    const fakeConfig = { root: tmpDir } as ResolvedConfig;
    (plugin.configResolved as (config: ResolvedConfig) => void)(fakeConfig);
    // No error means it worked
  });

  it("transformIndexHtml injects sorted script tags", async () => {
    const plugin = angularFilesort();
    const fakeConfig = { root: tmpDir } as ResolvedConfig;
    (plugin.configResolved as (config: ResolvedConfig) => void)(fakeConfig);

    const hook = plugin.transformIndexHtml as {
      order: string;
      handler: () => Promise<{ tag: string; attrs: { src: string }; injectTo: string }[]>;
    };

    expect(hook.order).toBe("pre");

    const tags = await hook.handler();

    expect(tags.length).toBe(2); // app.spec.js is excluded
    expect(tags.every((t) => t.tag === "script")).toBe(true);
    expect(tags.every((t) => t.injectTo === "body")).toBe(true);

    const srcs = tags.map((t) => t.attrs.src);
    const sharedIdx = srcs.findIndex((s) => s.includes("shared.js"));
    const appIdx = srcs.findIndex((s) => s.includes("app.js"));
    expect(sharedIdx).toBeLessThan(appIdx);
  });

  it("handles non-existent scanRoot gracefully", async () => {
    const plugin = angularFilesort({ scanRoot: "does-not-exist" });
    const fakeConfig = { root: tmpDir } as ResolvedConfig;
    (plugin.configResolved as (config: ResolvedConfig) => void)(fakeConfig);

    const hook = plugin.transformIndexHtml as {
      handler: () => Promise<unknown[]>;
    };

    const tags = await hook.handler();
    expect(tags).toEqual([]);
  });
});

describe("matchGlob", () => {
  it("matches simple wildcards", () => {
    expect(_matchGlob("app.js", "*.js")).toBe(true);
    expect(_matchGlob("app.ts", "*.js")).toBe(false);
  });

  it("matches double-star globstars", () => {
    expect(_matchGlob("src/app/module.js", "**/*.js")).toBe(true);
    expect(_matchGlob("module.js", "**/*.js")).toBe(true);
    expect(_matchGlob("deep/nested/path/file.js", "**/*.js")).toBe(true);
  });

  it("matches directory prefixes", () => {
    expect(_matchGlob("node_modules/pkg/index.js", "node_modules/**")).toBe(true);
    expect(_matchGlob("src/app.js", "node_modules/**")).toBe(false);
  });

  it("matches test file patterns", () => {
    expect(_matchGlob("app.spec.js", "**/*.spec.js")).toBe(true);
    expect(_matchGlob("dir/app.test.js", "**/*.test.js")).toBe(true);
    expect(_matchGlob("app.js", "**/*.spec.js")).toBe(false);
  });
});
