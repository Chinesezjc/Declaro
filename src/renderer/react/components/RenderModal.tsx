import { Fragment } from "react"
import type { ModalNode } from "../../../dsl"
import type { ComponentRenderer, RenderContext } from "../types"
import { withSignalHandler } from "../types"
import { getComponentRenderKey } from "../renderKeys"

type RenderModalProps = {
  node: ModalNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

export function RenderModal({ node, ctx, renderNode }: RenderModalProps) {
  const childCtx = withSignalHandler(ctx, node.onSignal, node)

  return (
    <section className="dsl-modal" id={node.id} data-modal-id={node.id}>
      {node.title && <h2>{node.title}</h2>}
      <div className="dsl-modal-body">
        {node.children.map((child, index) => (
          <Fragment key={getComponentRenderKey(child, index, "modal-child")}>
            {renderNode(child, childCtx)}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
