import type { ComponentBase } from "./core"
import type { ComponentNode } from "./component"

// Plugin component that can render via compile (HTML) and/or render (React)
export interface PluginComponent<TExtends = Record<string, unknown>> {
  type: string
  compile: (node: ComponentNode) => string
  render?: (node: ComponentNode, ctx: Record<string, unknown>) => unknown
  // For recursive tree walking, which child arrays to recurse into
  nested?: (node: ComponentNode) => ComponentNode[]
}

// Generic component factory for plugin authors
export type PluginNode = ComponentBase & {
  type: string
  [key: string]: unknown
}

const registry = new Map<string, PluginComponent>()

export function defineComponent(config: PluginComponent): PluginComponent {
  registry.set(config.type, config)
  return config
}

export function getPlugin(type: string): PluginComponent | undefined {
  return registry.get(type)
}

export function getPluginTypes(): string[] {
  return Array.from(registry.keys())
}

// Register a component factory that creates a DSL node.
// Plugin authors call this to create their component function.
export function createComponentFactory<T extends Record<string, unknown>>(
  type: string,
): (config: ComponentBase & T) => PluginNode & T {
  return (config) => ({ type, ...config } as PluginNode & T)
}
