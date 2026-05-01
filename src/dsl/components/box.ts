import type { Action, ComponentBase, ContentAlignX, ContentAlignY, SizeMode } from "../core"
import type { ComponentNode } from "../component"

export type BoxLayout = "vertical" | "horizontal" | "grid" | "inline"

export type BoxTone = "default" | "muted" | "accent" | "success" | "warning" | "danger"

export type BoxShadow = "none" | "subtle" | "raised"

export type BoxScroll = "none" | "x" | "y" | "both" | "auto"

export type BoxNode = ComponentBase & {
  type: "box"
  title?: string
  titleActions?: ComponentNode[]
  collapsible?: boolean
  defaultCollapsed?: boolean
  expandLabel?: string
  collapseLabel?: string
  onSignal?: Action
  tone?: BoxTone
  layout?: BoxLayout
  gap?: number | string
  padding?: number | string
  radius?: number | string
  borderWidth?: number | string
  shadow?: BoxShadow
  scroll?: BoxScroll
  maxHeight?: number | string
  maxWidth?: number | string
  columns?: number
  childrenAlignX?: ContentAlignX
  childrenAlignY?: ContentAlignY
  childrenSizeX?: SizeMode
  childrenSizeY?: SizeMode
  children: ComponentNode[]
}

export function Box(config: Omit<BoxNode, "type">): BoxNode {
  return {
    type: "box",
    ...config,
    titleActions: config.titleActions ? [...config.titleActions] : undefined,
    children: [...config.children],
  }
}
