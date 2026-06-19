import type { EnvNode } from "./env"
import type { BoxNode } from "./components/box"
import type { ButtonNode } from "./components/button"
import type { CardNode } from "./components/card"
import type { FormNode } from "./components/form"
import type { HtmlNode } from "./components/html"
import type { InputNode } from "./components/input"
import type { KatexNode } from "./components/katex"
import type { ListNode } from "./components/list"
import type { ModalNode } from "./components/modal"
import type { ScriptNode } from "./components/script"
import type { SelectNode } from "./components/select"
import type { SliderNode } from "./components/slider"
import type { TableNode } from "./components/table"
import type { TextNode } from "./components/text"
import type { TextAreaNode } from "./components/textarea"
import { type PluginNode, getPlugin } from "./plugin"

export type ComponentNode =
  | TextNode
  | BoxNode
  | ButtonNode
  | HtmlNode
  | InputNode
  | KatexNode
  | ScriptNode
  | SelectNode
  | SliderNode
  | TextAreaNode
  | FormNode
  | ListNode
  | TableNode
  | CardNode
  | ModalNode
  | PluginNode

export type SerializableIR =
  | null
  | string
  | number
  | boolean
  | SerializableIR[]
  | { [key: string]: SerializableIR }

export function sortByOrder<T extends { order?: number }>(nodes: readonly T[]): T[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const orderDelta = (a.node.order ?? 0) - (b.node.order ?? 0)
      return orderDelta === 0 ? a.index - b.index : orderDelta
    })
    .map(({ node }) => node)
}

export function normalizeId(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || `page-${shortHash(input || String(Date.now()))}`
}

export function validateSlots(env: EnvNode, children: readonly ComponentNode[]): void {
  validateSlotList(env, children)
}

export function sortComponentTree(children: readonly ComponentNode[]): ComponentNode[] {
  return sortByOrder(children.map(sortComponentNode))
}

export function groupBySlot(
  children: readonly ComponentNode[],
  defaultSlot = "main",
): Record<string, ComponentNode[]> {
  return children.reduce<Record<string, ComponentNode[]>>((groups, child) => {
    const slot = child.slot ?? defaultSlot
    groups[slot] = groups[slot] ?? []
    groups[slot].push(child)
    groups[slot] = sortByOrder(groups[slot])
    return groups
  }, {})
}

export function toSerializableIR(value: unknown): SerializableIR {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (typeof value === "function") {
    return {
      $type: "function",
      name: value.name || "anonymous",
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializableIR(item))
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toSerializableIR(entry)]),
    )
  }

  return null
}

function validateSlotList(env: EnvNode, children: readonly ComponentNode[], path = "children"): void {
  for (const child of children) {
    if (child.slot && !env.slots.includes(child.slot)) {
      throw new Error(`Invalid slot "${child.slot}" in component "${child.id ?? child.type}" at ${path}`)
    }

    const nested = getNestedChildren(child)
    if (nested.length > 0) {
      validateSlotList(env, nested, `${path}.${child.id ?? child.type}`)
    }
  }
}

function getNestedChildren(component: ComponentNode): ComponentNode[] {
  const plugin = getPlugin(component.type)
  if (plugin?.nested) return plugin.nested(component)
  // Legacy hardcoded fallback for built-ins without nested registered
  switch (component.type) {
    case "box":
      return [...(component.titleActions ?? []), ...component.children]
    case "card":
      return [
        ...(component.titleActions ?? []),
        ...(component.header ?? []),
        ...(component.body ?? []),
        ...(component.footer ?? []),
      ]
    case "form":
      return component.submitButton ? [...component.fields, component.submitButton] : [...component.fields]
    case "modal":
      return [...component.children]
    case "list":
      return [...(component.loading ?? []), ...(component.empty ?? [])]
    case "table":
      return [...(component.titleActions ?? []), ...(component.rowActions ?? [])]
    case "text":
      return [...(component.titleActions ?? [])]
    default:
      return []
  }
}

function sortComponentNode(component: ComponentNode): ComponentNode {
  switch (component.type) {
    case "box":
      return {
        ...component,
        titleActions: component.titleActions ? sortComponentTree(component.titleActions) : undefined,
        children: sortComponentTree(component.children),
      }
    case "card":
      return {
        ...component,
        titleActions: component.titleActions ? sortComponentTree(component.titleActions) : undefined,
        header: sortComponentTree(component.header ?? []),
        body: sortComponentTree(component.body ?? []),
        footer: sortComponentTree(component.footer ?? []),
      }
    case "form":
      return {
        ...component,
        fields: sortComponentTree(component.fields),
      }
    case "modal":
      return {
        ...component,
        children: sortComponentTree(component.children),
      }
    case "list":
      return {
        ...component,
        loading: component.loading ? sortComponentTree(component.loading) : undefined,
        empty: component.empty ? sortComponentTree(component.empty) : undefined,
      }
    case "table":
      return {
        ...component,
        titleActions: component.titleActions ? sortComponentTree(component.titleActions) : undefined,
        rowActions: component.rowActions ? sortByOrder(component.rowActions) : undefined,
      }
    case "text":
      return {
        ...component,
        titleActions: component.titleActions ? sortComponentTree(component.titleActions) : undefined,
      }
    default:
      return component
  }
}

function shortHash(input: string): string {
  let hash = 0

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36) || String(Date.now())
}
