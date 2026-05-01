import type { CSSProperties, ReactNode } from "react"
import type { AlignX, AlignY, ComponentBase, ComponentNode, ContentAlignX, ContentAlignY, SizeMode } from "../../dsl"
import type { ParentSizing } from "./types"

export function getContentAlignmentStyle(alignX?: ContentAlignX, alignY?: ContentAlignY): CSSProperties {
  const style: CSSProperties = {}

  if (alignX) {
    style.justifyContent = mapContentAlignX(alignX)

    if (isItemAlignX(alignX)) {
      style.justifyItems = mapItemAlignX(alignX)
    }
  }

  if (alignY) {
    style.alignContent = mapContentAlignY(alignY)

    if (isItemAlignY(alignY)) {
      style.alignItems = mapItemAlignY(alignY)
    }
  }

  return style
}

export function withSelfAlignment(component: ComponentNode, content: ReactNode, parentSizing: ParentSizing = {}): ReactNode {
  if (content === null || content === undefined || content === false) {
    return content
  }

  const style = getSelfLayoutStyle(component, parentSizing)

  if (!style) {
    return content
  }

  return (
    <div key={getComponentKey(component)} className="dsl-align-self" style={style}>
      {content}
    </div>
  )
}

function getSelfLayoutStyle(component: ComponentBase, parentSizing: ParentSizing): CSSProperties | undefined {
  const style: CSSProperties = {}

  if (component.alignX) {
    style.justifySelf = mapItemAlignX(component.alignX)
  }

  if (component.alignY) {
    style.alignSelf = mapItemAlignY(component.alignY)
  }

  applySizeX(style, component.sizeX ?? parentSizing.sizeX)
  applySizeY(style, component.sizeY ?? parentSizing.sizeY)

  return Object.keys(style).length > 0 ? style : undefined
}

function applySizeX(style: CSSProperties, size?: SizeMode): void {
  if (!size) {
    return
  }

  if (size === "fill") {
    style.width = "100%"
    style.minWidth = 0
    return
  }

  style.width = "fit-content"
  style.maxWidth = "100%"
}

function applySizeY(style: CSSProperties, size?: SizeMode): void {
  if (!size) {
    return
  }

  if (size === "fill") {
    style.height = "100%"
    style.minHeight = 0
    return
  }

  style.height = "fit-content"
  style.maxHeight = "100%"
}

function isItemAlignX(align: ContentAlignX): align is AlignX {
  return align === "left" || align === "center" || align === "right" || align === "stretch"
}

function isItemAlignY(align: ContentAlignY): align is AlignY {
  return align === "top" || align === "center" || align === "bottom" || align === "stretch"
}

function mapItemAlignX(align: AlignX): CSSProperties["justifySelf"] {
  switch (align) {
    case "left":
      return "start"
    case "right":
      return "end"
    case "center":
      return "center"
    case "stretch":
      return "stretch"
  }
}

function mapItemAlignY(align: AlignY): CSSProperties["alignSelf"] {
  switch (align) {
    case "top":
      return "start"
    case "bottom":
      return "end"
    case "center":
      return "center"
    case "stretch":
      return "stretch"
  }
}

function mapContentAlignX(align: ContentAlignX): CSSProperties["justifyContent"] {
  switch (align) {
    case "left":
      return "flex-start"
    case "right":
      return "flex-end"
    case "center":
      return "center"
    case "stretch":
      return "stretch"
    case "space-between":
      return "space-between"
    case "space-around":
      return "space-around"
    case "space-evenly":
      return "space-evenly"
  }
}

function mapContentAlignY(align: ContentAlignY): CSSProperties["alignContent"] {
  switch (align) {
    case "top":
      return "flex-start"
    case "bottom":
      return "flex-end"
    case "center":
      return "center"
    case "stretch":
      return "stretch"
    case "space-between":
      return "space-between"
    case "space-around":
      return "space-around"
    case "space-evenly":
      return "space-evenly"
  }
}

function getComponentKey(component: ComponentNode): string {
  if (component.id) {
    return component.id
  }

  switch (component.type) {
    case "button":
      return `${component.type}-${component.text}`
    case "box":
    case "card":
    case "table":
      return `${component.type}-${component.title ?? component.type}`
    case "form":
    case "modal":
      return `${component.type}-${component.id}`
    case "input":
    case "list":
    case "select":
    case "slider":
    case "textarea":
      return `${component.type}-${component.type === "list" ? component.id ?? component.dataSource ?? "list" : component.name}`
    case "text":
      return `${component.type}-${component.text}`
  }
}
