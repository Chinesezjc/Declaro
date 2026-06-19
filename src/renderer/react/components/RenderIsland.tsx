import React, { useState, useCallback } from "react"
import type { IslandNode } from "../../../dsl/components/island"
import type { RenderContext } from "../types"
import type { ComponentNode } from "../../../dsl"

interface RenderIslandProps {
  node: IslandNode
  ctx: RenderContext
  renderNode: (node: ComponentNode, ctx: RenderContext) => React.ReactNode
}

/**
 * React renderer for Declaro Islands.
 * Manages island-local state with useState and passes
 * a `set` function to handlers that triggers re-render.
 */
export function RenderIsland({ node, ctx, renderNode }: RenderIslandProps): React.ReactNode {
  const [state, setState] = useState<Record<string, unknown>>(node.initialState)

  const set = useCallback(
    (partial: Record<string, unknown>) => {
      setState((prev) => ({ ...prev, ...partial }))
    },
    [],
  )

  // Wrap handlers to provide (event, state, set)
  // The React renderer wraps handlers to accept a standard args
  // In dev mode, we expose handlers via a data attribute for debugging
  const child = node.render(state)
  return renderNode(child, ctx)
}
