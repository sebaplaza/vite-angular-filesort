import { describe, it, expect } from "vitest";
import { toposort, CyclicDependencyError } from "../toposort.ts";

describe("toposort", () => {
  it("sorts a linear chain", () => {
    const nodes = ["a", "b", "c"];
    // a depends on b, b depends on c
    const edges: [string, string][] = [
      ["a", "b"],
      ["b", "c"],
    ];

    const sorted = toposort(nodes, edges);
    expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("a"));
  });

  it("sorts a diamond dependency", () => {
    //     a
    //    / \
    //   b   c
    //    \ /
    //     d
    const nodes = ["a", "b", "c", "d"];
    const edges: [string, string][] = [
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["c", "d"],
    ];

    const sorted = toposort(nodes, edges);
    expect(sorted.indexOf("d")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("d")).toBeLessThan(sorted.indexOf("c"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("a"));
    expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("a"));
  });

  it("handles no edges", () => {
    const nodes = ["a", "b", "c"];
    const sorted = toposort(nodes, []);
    expect(sorted).toHaveLength(3);
    expect(sorted).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("handles a single node", () => {
    const sorted = toposort(["a"], []);
    expect(sorted).toEqual(["a"]);
  });

  it("handles disconnected subgraphs", () => {
    const nodes = ["a", "b", "c", "d"];
    // a -> b and c -> d are separate chains
    const edges: [string, string][] = [
      ["a", "b"],
      ["c", "d"],
    ];

    const sorted = toposort(nodes, edges);
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("a"));
    expect(sorted.indexOf("d")).toBeLessThan(sorted.indexOf("c"));
  });

  it("throws CyclicDependencyError on direct cycle", () => {
    const nodes = ["a", "b"];
    const edges: [string, string][] = [
      ["a", "b"],
      ["b", "a"],
    ];

    expect(() => toposort(nodes, edges)).toThrow(CyclicDependencyError);
  });

  it("throws CyclicDependencyError on indirect cycle", () => {
    const nodes = ["a", "b", "c"];
    const edges: [string, string][] = [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ];

    expect(() => toposort(nodes, edges)).toThrow(CyclicDependencyError);
  });

  it("ignores edges referencing unknown nodes", () => {
    const nodes = ["a", "b"];
    const edges: [string, string][] = [
      ["a", "b"],
      ["a", "unknown"],
    ];

    const sorted = toposort(nodes, edges);
    expect(sorted).toEqual(["b", "a"]);
  });

  it("preserves all nodes in output", () => {
    const nodes = ["a", "b", "c", "d", "e"];
    const edges: [string, string][] = [["a", "b"]];

    const sorted = toposort(nodes, edges);
    expect(sorted).toHaveLength(5);
    expect(new Set(sorted)).toEqual(new Set(nodes));
  });
});
