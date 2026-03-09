import { describe, it, expect } from "vitest";
import {
  parseNgDependencies,
  toposort,
  CyclicDependencyError,
  sortAngularFiles,
  sortAngularFilesSync,
  angularFilesort,
} from "../index.ts";

describe("index re-exports", () => {
  it("exports parseNgDependencies", () => {
    expect(parseNgDependencies).toBeTypeOf("function");
  });

  it("exports toposort", () => {
    expect(toposort).toBeTypeOf("function");
  });

  it("exports CyclicDependencyError", () => {
    expect(CyclicDependencyError).toBeTypeOf("function");
    expect(new CyclicDependencyError(["a", "b"])).toBeInstanceOf(Error);
  });

  it("exports sortAngularFiles", () => {
    expect(sortAngularFiles).toBeTypeOf("function");
  });

  it("exports sortAngularFilesSync", () => {
    expect(sortAngularFilesSync).toBeTypeOf("function");
  });

  it("exports angularFilesort", () => {
    expect(angularFilesort).toBeTypeOf("function");
  });
});
