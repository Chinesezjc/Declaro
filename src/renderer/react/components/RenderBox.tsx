import { Fragment, useState, type CSSProperties } from "react"
import type { BoxNode } from "../../../dsl"
import type { ComponentRenderer, RenderContext } from "../types"
import { withSignalHandler } from "../types"
import { getContentAlignmentStyle } from "../alignment"
import { getComponentRenderKey } from "../renderKeys"

type RenderBoxProps = {
  node: BoxNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

export function RenderBox({ node, ctx, renderNode }: RenderBoxProps) {
  const [collapsed, setCollapsed] = useState(Boolean(node.defaultCollapsed))
  const childCtx = withSignalHandler(ctx, node.onSignal, node)
  const titleActions = node.titleActions ?? []
  const hasTitlebar = Boolean(node.title) || titleActions.length > 0 || Boolean(node.collapsible)
  const boxStyle: CSSProperties = {
    gap: typeof node.gap === "number" ? `${node.gap}px` : node.gap,
    padding: node.padding === undefined ? undefined : toCssSize(node.padding),
    borderRadius: node.radius === undefined ? undefined : toCssSize(node.radius),
    borderWidth: node.borderWidth === undefined ? undefined : toCssSize(node.borderWidth),
    boxShadow: mapShadow(node.shadow),
    maxHeight: node.maxHeight === undefined ? undefined : toCssSize(node.maxHeight),
    maxWidth: node.maxWidth === undefined ? undefined : toCssSize(node.maxWidth),
  }
  const childrenStyle: CSSProperties = {
    ...getContentAlignmentStyle(node.childrenAlignX, node.childrenAlignY),
    ...getScrollStyle(node.scroll),
    gridTemplateColumns:
      node.layout === "grid" && node.columns ? `repeat(${node.columns}, minmax(0, 1fr))` : undefined,
  }

  return (
    <section
      className={["dsl-box", `dsl-box-${node.layout ?? "vertical"}`, `dsl-box-tone-${node.tone ?? "default"}`].join(
        " ",
      )}
      style={boxStyle}
    >
      {hasTitlebar && (
        <div className="dsl-titlebar">
          {node.title && <h2 className="dsl-box-title">{node.title}</h2>}
          {titleActions.length > 0 && (
            <div className="dsl-title-actions">
              {titleActions.map((action, index) => (
                <Fragment key={getComponentRenderKey(action, index, "box-title-action")}>
                  {renderNode(action, childCtx)}
                </Fragment>
              ))}
            </div>
          )}
          {node.collapsible && (
            <button
              className="dsl-collapse-toggle"
              type="button"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? (node.expandLabel ?? "展开") : (node.collapseLabel ?? "收起")}
            </button>
          )}
        </div>
      )}
      {!collapsed && (
        <div className="dsl-box-children" style={childrenStyle}>
          {node.children.map((child, index) => (
            <Fragment key={getComponentRenderKey(child, index, "box-child")}>
              {renderNode(child, childCtx, {
                sizeX: node.childrenSizeX,
                sizeY: node.childrenSizeY,
              })}
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}

function toCssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value
}

function mapShadow(shadow: BoxNode["shadow"]): CSSProperties["boxShadow"] {
  if (shadow === "none" || shadow === undefined) {
    return undefined
  }

  if (shadow === "subtle") {
    return "0 1px 2px rgba(15, 23, 42, 0.08)"
  }

  return "0 8px 20px rgba(15, 23, 42, 0.12)"
}

function getScrollStyle(scroll: BoxNode["scroll"]): CSSProperties {
  switch (scroll) {
    case "x":
      return { overflowX: "auto", overflowY: "hidden" }
    case "y":
      return { overflowX: "hidden", overflowY: "auto" }
    case "both":
      return { overflow: "auto" }
    case "auto":
      return { overflow: "auto" }
    case "none":
    case undefined:
      return {}
  }
}
