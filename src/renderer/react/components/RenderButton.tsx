import type { ButtonNode } from "../../../dsl"
import type { RenderContext } from "../types"
import { executeAction } from "../types"

type RenderButtonProps = {
  node: ButtonNode
  ctx: RenderContext
  row?: Record<string, unknown>
  form?: {
    id: string
    values: Record<string, unknown>
  }
  type?: "button" | "submit"
  executeClickAction?: boolean
  className?: string
}

export function RenderButton({
  node,
  ctx,
  row,
  form,
  type = "button",
  executeClickAction = true,
  className,
}: RenderButtonProps) {
  const actionOverrides = { row, form }

  return (
    <button
      className={["dsl-button", `dsl-button-${node.variant ?? "secondary"}`, className].filter(Boolean).join(" ")}
      type={type}
      disabled={node.disabled}
      onClick={() => {
        if (executeClickAction) {
          void executeAction(node.onClick, ctx, node, actionOverrides)
        }
      }}
      onMouseEnter={() => {
        void executeAction(node.onHover, ctx, node, actionOverrides)
      }}
    >
      {node.text}
    </button>
  )
}
