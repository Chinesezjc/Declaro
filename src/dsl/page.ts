import type { Role } from "./core"
import type { EnvNode } from "./env"
import type { ComponentNode } from "./component"
import { normalizeId, sortComponentTree, validateSlots } from "./component"

export type PageConfig = {
  id?: string
  title: string
  env: EnvNode
  role?: Role
  head?: ComponentNode[]
  children: ComponentNode[]
}

export type PageNode = {
  type: "page"
  id: string
  title: string
  env: EnvNode
  role?: Role
  head?: ComponentNode[]
  children: ComponentNode[]
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
    children: sortComponentTree(config.children),
  }
}
