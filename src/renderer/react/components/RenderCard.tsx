import { Fragment, useState } from "react"
import type { CardNode } from "../../../dsl"
import type { ComponentRenderer, RenderContext } from "../types"
import { withSignalHandler } from "../types"
import { getComponentRenderKey } from "../renderKeys"

type RenderCardProps = {
  node: CardNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

export function RenderCard({ node, ctx, renderNode }: RenderCardProps) {
  const [collapsed, setCollapsed] = useState(Boolean(node.defaultCollapsed))
  const childCtx = withSignalHandler(ctx, node.onSignal, node)
  const titleActions = node.titleActions ?? []
  const header = node.header ?? []
  const body = node.body ?? []
  const footer = node.footer ?? []
  const hasTitlebar = Boolean(node.title) || titleActions.length > 0 || Boolean(node.collapsible)
  const hasHeader = hasTitlebar || header.length > 0
  const hasFooter = footer.length > 0

  return (
    <section className="dsl-card">
      {hasHeader && (
        <div className="dsl-card-header">
          {hasTitlebar && (
            <div className="dsl-titlebar">
              {node.title && <h2>{node.title}</h2>}
              {titleActions.length > 0 && (
                <div className="dsl-title-actions">
                  {titleActions.map((action, index) => (
                    <Fragment key={getComponentRenderKey(action, index, "card-title-action")}>
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
          {!collapsed &&
            header.map((child, index) => (
              <Fragment key={getComponentRenderKey(child, index, "card-header")}>
                {renderNode(child, childCtx)}
              </Fragment>
            ))}
        </div>
      )}
      {!collapsed && (
        <div className="dsl-card-body">
          {body.map((child, index) => (
            <Fragment key={getComponentRenderKey(child, index, "card-body")}>
              {renderNode(child, childCtx)}
            </Fragment>
          ))}
        </div>
      )}
      {!collapsed && hasFooter && (
        <div className="dsl-card-footer">
          {footer.map((child, index) => (
            <Fragment key={getComponentRenderKey(child, index, "card-footer")}>
              {renderNode(child, childCtx)}
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}
