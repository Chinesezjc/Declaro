import { Fragment, type CSSProperties } from "react"
import type { TextNode } from "../../../dsl"
import type { ComponentRenderer, RenderContext } from "../types"
import { getComponentRenderKey } from "../renderKeys"

type RenderTextProps = {
  node: TextNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

export function RenderText({ node, ctx, renderNode }: RenderTextProps) {
  const Tag: keyof JSX.IntrinsicElements =
    node.variant === "title" ? "h1" : node.variant === "subtitle" ? "h2" : node.variant === "caption" ? "small" : "p"
  const titleActions = node.titleActions ?? []
  const text = (
    <Tag className={`dsl-text dsl-text-${node.variant ?? "body"}`} style={getTextStyle(node)}>
      {renderTextContent(node)}
    </Tag>
  )

  if (titleActions.length === 0) {
    return text
  }

  return (
    <div className="dsl-titlebar">
      {text}
      <div className="dsl-title-actions">
        {titleActions.map((action, index) => (
          <Fragment key={getComponentRenderKey(action, index, "text-title-action")}>
            {renderNode(action, ctx)}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function getTextStyle(node: TextNode): CSSProperties | undefined {
  if (!node.lineHeight) {
    return undefined
  }

  return {
    lineHeight: mapLineHeight(node.lineHeight),
  }
}

function renderTextContent(node: TextNode) {
  const paragraphs = node.text.split(/\n\s*\n/g)

  if (paragraphs.length === 1) {
    return node.text
  }

  return paragraphs.map((paragraph, index) => (
    <span
      className="dsl-text-paragraph"
      key={`${paragraph}-${index}`}
      style={
        index < paragraphs.length - 1 && node.paragraphSpacing !== undefined
          ? { marginBlockEnd: toCssSize(node.paragraphSpacing) }
          : undefined
      }
    >
      {paragraph}
    </span>
  ))
}

function mapLineHeight(lineHeight: TextNode["lineHeight"]): CSSProperties["lineHeight"] {
  if (lineHeight === "tight") {
    return 1.2
  }

  if (lineHeight === "normal") {
    return 1.5
  }

  if (lineHeight === "relaxed") {
    return 1.75
  }

  if (lineHeight === "loose") {
    return 2
  }

  return lineHeight
}

function toCssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value
}
