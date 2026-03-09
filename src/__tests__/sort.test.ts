import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sortAngularFilesSync, sortAngularFiles } from "../sort.ts";

describe("sortAngularFilesSync", () => {
  it("sorts files by module dependencies", () => {
    const files = [
      {
        filePath: "/app.js",
        content: "angular.module('app', ['service', 'utils'])",
      },
      {
        filePath: "/service.js",
        content: "angular.module('service', [])",
      },
      {
        filePath: "/utils.js",
        content: "angular.module('utils', [])",
      },
    ];

    const sorted = sortAngularFilesSync(files);

    const appIdx = sorted.indexOf("/app.js");
    const svcIdx = sorted.indexOf("/service.js");
    const utilsIdx = sorted.indexOf("/utils.js");

    expect(appIdx).toBeGreaterThan(svcIdx);
    expect(appIdx).toBeGreaterThan(utilsIdx);
  });

  it("handles deep dependency chains", () => {
    const files = [
      {
        filePath: "/a.js",
        content: "angular.module('a', ['b'])",
      },
      {
        filePath: "/b.js",
        content: "angular.module('b', ['c'])",
      },
      {
        filePath: "/c.js",
        content: "angular.module('c', [])",
      },
    ];

    const sorted = sortAngularFilesSync(files);
    expect(sorted).toEqual(["/c.js", "/b.js", "/a.js"]);
  });

  it("includes files without angular modules", () => {
    const files = [
      { filePath: "/app.js", content: "angular.module('app', [])" },
      { filePath: "/helper.js", content: "var x = 42;" },
    ];

    const sorted = sortAngularFilesSync(files);
    expect(sorted).toHaveLength(2);
    expect(sorted).toContain("/helper.js");
    expect(sorted).toContain("/app.js");
  });

  it("ignores dependencies on modules not in the file set", () => {
    const files = [
      {
        filePath: "/app.js",
        content: "angular.module('app', ['ui.router', 'service'])",
      },
      {
        filePath: "/service.js",
        content: "angular.module('service', [])",
      },
    ];

    const sorted = sortAngularFilesSync(files);
    expect(sorted.indexOf("/app.js")).toBeGreaterThan(sorted.indexOf("/service.js"));
  });

  it("handles getter references as dependencies", () => {
    const files = [
      {
        filePath: "/controller.js",
        content: "angular.module('app').controller('MainCtrl', function() {})",
      },
      {
        filePath: "/app.js",
        content: "angular.module('app', [])",
      },
    ];

    const sorted = sortAngularFilesSync(files);
    expect(sorted.indexOf("/app.js")).toBeLessThan(sorted.indexOf("/controller.js"));
  });

  it("handles multiple modules declared in one file", () => {
    const files = [
      {
        filePath: "/bundle.js",
        content: ["angular.module('app', ['templates']);", "angular.module('templates', []);"].join(
          "\n",
        ),
      },
      {
        filePath: "/other.js",
        content: "angular.module('other', ['app'])",
      },
    ];

    const sorted = sortAngularFilesSync(files);
    expect(sorted.indexOf("/bundle.js")).toBeLessThan(sorted.indexOf("/other.js"));
  });

  it("handles diamond dependencies", () => {
    const files = [
      {
        filePath: "/app.js",
        content: "angular.module('app', ['auth', 'api'])",
      },
      {
        filePath: "/auth.js",
        content: "angular.module('auth', ['http'])",
      },
      {
        filePath: "/api.js",
        content: "angular.module('api', ['http'])",
      },
      {
        filePath: "/http.js",
        content: "angular.module('http', [])",
      },
    ];

    const sorted = sortAngularFilesSync(files);
    const idx = (f: string) => sorted.indexOf(f);

    expect(idx("/http.js")).toBeLessThan(idx("/auth.js"));
    expect(idx("/http.js")).toBeLessThan(idx("/api.js"));
    expect(idx("/auth.js")).toBeLessThan(idx("/app.js"));
    expect(idx("/api.js")).toBeLessThan(idx("/app.js"));
  });

  it("handles empty file list", () => {
    expect(sortAngularFilesSync([])).toEqual([]);
  });

  it("handles realistic AngularJS structure", () => {
    const files = [
      {
        filePath: "/app/app.module.js",
        content: "angular.module('myApp', ['myApp.home', 'myApp.shared', 'ngRoute'])",
      },
      {
        filePath: "/app/home/home.module.js",
        content: "angular.module('myApp.home', ['myApp.shared'])",
      },
      {
        filePath: "/app/home/home.controller.js",
        content: "angular.module('myApp.home').controller('HomeCtrl', function() {})",
      },
      {
        filePath: "/app/shared/shared.module.js",
        content: "angular.module('myApp.shared', [])",
      },
      {
        filePath: "/app/shared/api.service.js",
        content: "angular.module('myApp.shared').factory('ApiService', function() {})",
      },
    ];

    const sorted = sortAngularFilesSync(files);
    const idx = (f: string) => sorted.indexOf(f);

    expect(idx("/app/shared/shared.module.js")).toBeLessThan(idx("/app/home/home.module.js"));
    expect(idx("/app/shared/shared.module.js")).toBeLessThan(idx("/app/app.module.js"));
    expect(idx("/app/home/home.module.js")).toBeLessThan(idx("/app/app.module.js"));
    expect(idx("/app/shared/shared.module.js")).toBeLessThan(idx("/app/shared/api.service.js"));
    expect(idx("/app/home/home.module.js")).toBeLessThan(idx("/app/home/home.controller.js"));
  });
});

describe("sortAngularFiles", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "angular-sort-"));
    await writeFile(join(tmpDir, "app.js"), "angular.module('app', ['service'])");
    await writeFile(join(tmpDir, "service.js"), "angular.module('service', [])");
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it("reads files from disk and sorts by dependencies", async () => {
    const sorted = await sortAngularFiles([join(tmpDir, "app.js"), join(tmpDir, "service.js")]);

    expect(sorted.indexOf(join(tmpDir, "service.js"))).toBeLessThan(
      sorted.indexOf(join(tmpDir, "app.js")),
    );
  });
});
