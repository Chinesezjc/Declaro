import type { Role } from "./core"
import type { EnvNode } from "./env"
import type { ComponentNode } from "./component"
import { normalizeId, sortComponentTree, validateSlots } from "./component"

export interface StateRef {
  /** Serialized initial state for codegen */
  __dsl_pageState: Record<string, unknown>
}

export type PageConfig = {
  id?: string
  title: string
  env: EnvNode
  role?: Role
  head?: ComponentNode[]
  /** Page-level reactive state shared across all islands */
  state?: Record<string, unknown>
  children: ComponentNode[]
}

export type PageNode = {
  type: "page"
  id: string
  title: string
  env: EnvNode
  role?: Role
  head?: ComponentNode[]
  /** Page-level state initial values */
  state?: Record<string, unknown>
  children: ComponentNode[]
}

/**
 * Create a page-level state container.
 * Islands with `usePageState: true` can access this state.
 */
export function PageState<T extends Record<string, unknown>>(initial: T): T {
  return initial
}

export function Page(config: PageConfig): PageNode {
  validateSlots(config.env, config.children)

  return {
    type: "page",
    id: config.id ?? normalizeId(config.title),
    title: config.title,
    env: config.env,
    role: config.role,
    head: config.head ? sortComponentTree(config.head) : undefined,
    state: config.state,
    children: sortComponentTree(config.children),
  }
}
