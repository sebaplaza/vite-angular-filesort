import { describe, it, expect } from "vitest";
import { parseNgDependencies } from "../parser.ts";

describe("parseNgDependencies", () => {
  describe("setter declarations", () => {
    it("parses a module with dependencies", () => {
      const result = parseNgDependencies("angular.module('app', ['service', 'utils'])");
      expect(result.modules).toEqual({ app: ["service", "utils"] });
      expect(result.dependencies).toEqual(["service", "utils"]);
    });

    it("parses a module with empty dependencies", () => {
      const result = parseNgDependencies("angular.module('myModule', [])");
      expect(result.modules).toEqual({ myModule: [] });
      expect(result.dependencies).toEqual([]);
    });

    it("parses double-quoted module names", () => {
      const result = parseNgDependencies('angular.module("app", ["service"])');
      expect(result.modules).toEqual({ app: ["service"] });
      expect(result.dependencies).toEqual(["service"]);
    });

    it("handles dotted module names", () => {
      const result = parseNgDependencies("angular.module('my.app.module', ['ui.router'])");
      expect(result.modules).toEqual({ "my.app.module": ["ui.router"] });
      expect(result.dependencies).toEqual(["ui.router"]);
    });

    it("handles hyphenated module names", () => {
      const result = parseNgDependencies("angular.module('my-app', ['my-service'])");
      expect(result.modules).toEqual({ "my-app": ["my-service"] });
      expect(result.dependencies).toEqual(["my-service"]);
    });
  });

  describe("getter references", () => {
    it("parses a getter reference", () => {
      const result = parseNgDependencies("angular.module('app')");
      expect(result.modules).toEqual({});
      expect(result.dependencies).toEqual(["app"]);
    });

    it("parses getter with chained call", () => {
      const result = parseNgDependencies(
        "angular.module('app').controller('MainCtrl', function() {})",
      );
      expect(result.modules).toEqual({});
      expect(result.dependencies).toEqual(["app"]);
    });
  });

  describe("multiple modules in one file", () => {
    it("parses multiple declarations", () => {
      const source = [
        "angular.module('app', ['templates']);",
        "angular.module('templates', []);",
      ].join("\n");

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ app: ["templates"], templates: [] });
      expect(result.dependencies).toEqual([]);
    });

    it("parses mixed declarations and references", () => {
      const source = [
        "angular.module('app', ['utils']);",
        "angular.module('service').factory('svc', function() {});",
      ].join("\n");

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ app: ["utils"] });
      expect(result.dependencies).toEqual(expect.arrayContaining(["utils", "service"]));
    });
  });

  describe("ng module filtering", () => {
    it("excludes the ng module from dependencies", () => {
      const result = parseNgDependencies("angular.module('app', ['ng', 'service'])");
      expect(result.dependencies).toEqual(["service"]);
      expect(result.dependencies).not.toContain("ng");
    });
  });

  describe("comment handling", () => {
    it("ignores angular.module in single-line comments", () => {
      const source = ["// angular.module('commented', ['dep'])", "angular.module('real', [])"].join(
        "\n",
      );

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ real: [] });
      expect(Object.keys(result.modules)).not.toContain("commented");
    });

    it("ignores angular.module in multi-line comments", () => {
      const source = [
        "/* angular.module('commented', ['dep']) */",
        "angular.module('real', [])",
      ].join("\n");

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ real: [] });
    });

    it("preserves angular.module inside string literals", () => {
      const source = [
        "var s = \"angular.module('inString', ['dep'])\";",
        "angular.module('real', [])",
      ].join("\n");

      const result = parseNgDependencies(source);
      expect(result.modules).toHaveProperty("real");
    });
  });

  describe("whitespace handling", () => {
    it("handles multiline dependency arrays", () => {
      const source = `angular.module('app', [
        'service',
        'utils',
        'config'
      ])`;

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({
        app: ["service", "utils", "config"],
      });
    });

    it("handles spaces around dots and parens", () => {
      const result = parseNgDependencies("angular . module ( 'app' , [ 'dep' ] )");
      expect(result.modules).toEqual({ app: ["dep"] });
    });
  });

  describe("edge cases", () => {
    it("returns empty for files without angular", () => {
      const result = parseNgDependencies("var x = 42;");
      expect(result.modules).toEqual({});
      expect(result.dependencies).toEqual([]);
    });

    it("returns empty for empty input", () => {
      const result = parseNgDependencies("");
      expect(result.modules).toEqual({});
      expect(result.dependencies).toEqual([]);
    });

    it("handles file with only IIFE wrapper", () => {
      const source = `(function() {
        'use strict';
        angular.module('app', ['dep']);
      })();`;

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ app: ["dep"] });
    });

    it("handles escaped characters inside string literals", () => {
      const source = ["var s = 'some \\'escaped\\' string';", "angular.module('app', [])"].join(
        "\n",
      );

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ app: [] });
    });

    it("handles template literals in source", () => {
      const source = ["var t = `template with ${expr}`;", "angular.module('app', [])"].join("\n");

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ app: [] });
    });

    it("excludes ng getter reference from dependencies", () => {
      const source = "angular.module('ng').run(function() {})";
      const result = parseNgDependencies(source);
      expect(result.dependencies).toEqual([]);
    });

    it("excludes getter reference to a module declared in the same file", () => {
      const source = [
        "angular.module('app', []);",
        "angular.module('app').controller('Ctrl', function() {});",
      ].join("\n");

      const result = parseNgDependencies(source);
      expect(result.modules).toEqual({ app: [] });
      expect(result.dependencies).toEqual([]);
    });
  });
});
