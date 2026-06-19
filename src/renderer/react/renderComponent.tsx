import type React from "react"
import { createElement } from "react"
import katex from "katex"
import type { ComponentNode } from "../../dsl"
import { getPlugin } from "../../dsl/plugin"
import { withSelfAlignment } from "./alignment"
import type { ParentSizing, RenderContext } from "./types"
import { canRenderComponent } from "./visibility"
import { RenderBox } from "./components/RenderBox"
import { RenderButton } from "./components/RenderButton"
import { RenderCard } from "./components/RenderCard"
import { RenderForm } from "./components/RenderForm"
import { RenderInput } from "./components/RenderInput"
import { RenderList } from "./components/RenderList"
import { RenderModal } from "./components/RenderModal"
import { RenderTable } from "./components/RenderTable"
import { RenderText } from "./components/RenderText"

export function renderComponent(component: ComponentNode, ctx: RenderContext, parentSizing?: ParentSizing): React.ReactNode {
  if (!canRenderComponent(component, ctx.user)) {
    return null
  }

  const content = renderComponentContent(component, ctx)
  return withSelfAlignment(component, content, parentSizing)
}

function renderComponentContent(component: ComponentNode, ctx: RenderContext): React.ReactNode {
  switch (component.type) {
    case "box":
      return <RenderBox key={component.id ?? component.title} node={component} ctx={ctx} renderNode={renderComponent} />
    case "button":
      return <RenderButton key={component.id ?? component.text} node={component} ctx={ctx} />
    case "card":
      return <RenderCard key={component.id ?? component.title} node={component} ctx={ctx} renderNode={renderComponent} />
    case "form":
      return <RenderForm key={component.id} node={component} ctx={ctx} renderNode={renderComponent} />
    case "input":
    case "select":
    case "slider":
    case "textarea":
      return <RenderInput key={component.id ?? component.name} node={component} ctx={ctx} />
    case "list":
      return (
        <RenderList
          key={component.id ?? component.dataSource ?? "list"}
          node={component}
          ctx={ctx}
          renderNode={renderComponent}
        />
      )
    case "modal":
      return <RenderModal key={component.id} node={component} ctx={ctx} renderNode={renderComponent} />
    case "table":
      return (
        <RenderTable
          key={component.id ?? component.title ?? component.dataSource}
          node={component}
          ctx={ctx}
          renderNode={renderComponent}
        />
      )
    case "html":
      return createElement("span", {
        key: component.id ?? "html",
        className: "dsl-html",
        dangerouslySetInnerHTML: { __html: component.html },
      })
    case "katex": {
      let katexHtml = ""
      try {
        katexHtml = katex.renderToString(component.expression, {
          displayMode: component.displayMode ?? false,
          throwOnError: false,
        })
      } catch {
        katexHtml = escapeHtml(component.expression)
      }
      const tag = component.displayMode ? "div" : "span"
      const cls = component.displayMode ? "dsl-katex dsl-katex-block" : "dsl-katex dsl-katex-inline"
      return createElement(tag, {
        key: component.id ?? "katex",
        className: cls,
        dangerouslySetInnerHTML: { __html: katexHtml },
      })
    }
    case "script":
      // Script nodes are for <head>, don't render in body
      return null
    case "text":
      return <RenderText key={component.id ?? component.text} node={component} ctx={ctx} renderNode={renderComponent} />
    default: {
      // Plugin component — render as HTML wrapper
      const plugin = getPlugin(component.type)
      if (plugin) {
        const html = plugin.compile(component)
        return createElement("span", {
          key: component.id ?? component.type,
          className: `dsl-plugin dsl-plugin-${component.type}`,
          dangerouslySetInnerHTML: { __html: html },
        })
      }
      return null
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
