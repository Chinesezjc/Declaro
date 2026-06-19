import type { ComponentBase } from "../core"

export type HtmlNode = ComponentBase & {
  type: "html"
  html: string
}

export function Html(config: Omit<HtmlNode, "type">): HtmlNode {
  return {
    type: "html",
    ...config,
  }
}
