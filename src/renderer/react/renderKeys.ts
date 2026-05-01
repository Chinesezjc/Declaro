import type { ComponentNode } from "../../dsl"

export function getComponentRenderKey(component: ComponentNode, index: number, prefix = "component"): string {
  if (component.id) {
    return component.id
  }

  switch (component.type) {
    case "button":
      return `${prefix}-button-${component.text}-${index}`
    case "box":
    case "card":
    case "table":
      return `${prefix}-${component.type}-${component.title ?? index}`
    case "form":
    case "modal":
      return `${prefix}-${component.type}-${component.id}-${index}`
    case "input":
    case "select":
    case "slider":
    case "textarea":
      return `${prefix}-${component.type}-${component.name}-${index}`
    case "list":
      return `${prefix}-list-${component.dataSource ?? index}`
    case "text":
      return `${prefix}-text-${component.text}-${index}`
  }
}
