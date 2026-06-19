import type { ComponentBase } from "../core"

export type KatexNode = ComponentBase & {
  type: "katex"
  expression: string
  displayMode?: boolean
}

export function Katex(config: Omit<KatexNode, "type">): KatexNode {
  return {
    type: "katex",
    ...config,
  }
}
