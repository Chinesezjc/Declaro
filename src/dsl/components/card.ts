import type { Action, ComponentBase } from "../core"
import type { ComponentNode } from "../component"

export type CardNode = ComponentBase & {
  type: "card"
  title?: string
  titleActions?: ComponentNode[]
  collapsible?: boolean
  defaultCollapsed?: boolean
  expandLabel?: string
  collapseLabel?: string
  onSignal?: Action
  header?: ComponentNode[]
  body?: ComponentNode[]
  footer?: ComponentNode[]
}

export function Card(config: Omit<CardNode, "type">): CardNode {
  return {
    type: "card",
    ...config,
    titleActions: config.titleActions ? [...config.titleActions] : undefined,
    header: config.header ?? [],
    body: config.body ?? [],
    footer: config.footer ?? [],
  }
}
