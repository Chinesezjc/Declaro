import type { ComponentBase } from "../core"
import type { ComponentNode } from "../component"

export type TextLineHeight = "tight" | "normal" | "relaxed" | "loose" | number | string

export type TextNode = ComponentBase & {
  type: "text"
  text: string
  variant?: "title" | "subtitle" | "body" | "caption"
  titleActions?: ComponentNode[]
  lineHeight?: TextLineHeight
  paragraphSpacing?: number | string
}

export function Text(config: Omit<TextNode, "type">): TextNode {
  return {
    type: "text",
    ...config,
    titleActions: config.titleActions ? [...config.titleActions] : undefined,
  }
}
