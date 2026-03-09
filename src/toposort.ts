/**
 * Topological sort implementation using depth-first search.
 *
 * Sorts directed acyclic graphs (DAGs) so that dependencies appear before
 * their dependents. Throws on cyclic dependencies.
 *
 * @module toposort
 */

/**
 * Error thrown when a cyclic dependency is detected during topological sort.
 *
 * @example
 * ```ts
 * try {
 *   toposort(['a', 'b'], [['a', 'b'], ['b', 'a']]);
 * } catch (e) {
 *   if (e instanceof CyclicDependencyError) {
 *     console.log(e.cycle); // ['a', 'b', 'a']
 *   }
 * }
 * ```
 */
export class CyclicDependencyError extends Error {
  /** The nodes forming the cycle, with the first node repeated at the end. */
  readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(" -> ")}`);
    this.name = "CyclicDependencyError";
    this.cycle = cycle;
  }
}

/**
 * Topological sort using depth-first search (DFS).
 *
 * Given a set of nodes and directed edges, returns the nodes ordered so that
 * every dependency appears before its dependents. Edges are interpreted as
 * `[dependent, dependency]` — meaning the first element depends on the second.
 *
 * Nodes with no edges are included in the output in their original order
 * relative to other unconstrained nodes.
 *
 * @typeParam T - The type of node identifiers (must be usable as Map/Set keys)
 * @param nodes - All nodes in the graph
 * @param edges - Directed edges as `[dependent, dependency]` pairs
 * @returns Nodes sorted in dependency order (dependencies first)
 * @throws {CyclicDependencyError} When a cycle is detected in the graph
 *
 * @example
 * ```ts
 * // a depends on b, b depends on c
 * toposort(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
 * // => ['c', 'b', 'a']
 * ```
 */
export function toposort<T>(nodes: T[], edges: [T, T][]): T[] {
  // Build adjacency map: node -> set of nodes it depends on
  const outgoing = new Map<T, Set<T>>();
  const nodeSet = new Set(nodes);

  for (const node of nodes) {
    outgoing.set(node, new Set());
  }

  // Only add edges where both endpoints exist in the node set
  for (const [from, to] of edges) {
    if (nodeSet.has(from) && nodeSet.has(to)) {
      outgoing.get(from)!.add(to);
    }
  }

  const sorted: T[] = [];
  /** Nodes that have been fully processed */
  const visited = new Set<T>();
  /** Nodes currently in the DFS path — used for cycle detection */
  const visiting = new Set<T>();
  /** Current DFS path for cycle reporting */
  const path: T[] = [];

  /**
   * Visit a node via DFS, recursively visiting its dependencies first.
   * Nodes are added to `sorted` in post-order (after all deps are processed).
   */
  function visit(node: T): void {
    if (visited.has(node)) return;

    // If we encounter a node already in the current path, we have a cycle
    if (visiting.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = [...path.slice(cycleStart), node];
      throw new CyclicDependencyError(cycle.map(String));
    }

    visiting.add(node);
    path.push(node);

    // Recursively visit all dependencies first
    for (const dep of outgoing.get(node)!) {
      visit(dep);
    }

    path.pop();
    visiting.delete(node);
    visited.add(node);
    sorted.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return sorted;
}
