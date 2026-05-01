import type React from "react"
import { Fragment, useEffect } from "react"
import type { PageNode } from "../../dsl"
import { groupBySlot } from "../../dsl"
import { renderComponent } from "./renderComponent"
import { getComponentRenderKey } from "./renderKeys"
import type { RenderContext, RuntimeContext } from "./types"
import { createDefaultRuntimeContext } from "./types"
import { canAccessPage } from "./visibility"

type RenderPageProps = {
  page: PageNode
  runtimeCtx?: RuntimeContext
}

type RenderSlot = (slot: string, element?: keyof JSX.IntrinsicElements) => React.ReactNode

export function renderPage(page: PageNode, runtimeCtx: RuntimeContext = createDefaultRuntimeContext()): React.ReactNode {
  return <RenderPage page={page} runtimeCtx={runtimeCtx} />
}

export function RenderPage({ page, runtimeCtx = createDefaultRuntimeContext() }: RenderPageProps) {
  useEffect(() => {
    document.title = page.title
  }, [page.title])

  if (!canAccessPage(page, runtimeCtx.user)) {
    return (
      <div className="dsl-page dsl-access-denied">
        <h1>无权访问页面</h1>
        <p>{page.title}</p>
      </div>
    )
  }

  const defaultSlot = page.env.slots.includes("main") ? "main" : page.env.slots[0] ?? "main"
  const slots = groupBySlot(page.children, defaultSlot)
  const ctx: RenderContext = {
    ...runtimeCtx,
    pageId: page.id,
  }

  const renderSlot: RenderSlot = (slot, Element = "section") => {
    const children = slots[slot] ?? []

    if (children.length === 0) {
      return null
    }

    return (
      <Element className={`dsl-slot dsl-slot-${slot}`} data-slot={slot} key={slot}>
        {children.map((child, index) => (
          <Fragment key={getComponentRenderKey(child, index, slot)}>{renderComponent(child, ctx)}</Fragment>
        ))}
      </Element>
    )
  }

  return (
    <div className={`dsl-page dsl-layout-${page.env.layout}`} data-page-id={page.id} data-env-id={page.env.id}>
      {renderLayout(page, renderSlot)}
    </div>
  )
}

function renderLayout(page: PageNode, renderSlot: RenderSlot): React.ReactNode {
  if (page.env.layout === "dashboard") {
    const dashboardSlots = new Set(["header", "sidebar", "toolbar", "main", "footer", "modal"])
    const extraSlots = page.env.slots.filter((slot) => !dashboardSlots.has(slot))

    return (
      <div className="dsl-dashboard-shell">
        {renderSlot("header", "header")}
        <div className="dsl-dashboard-body">
          {renderSlot("sidebar", "aside")}
          <div className="dsl-dashboard-content">
            {renderSlot("toolbar", "section")}
            {renderSlot("main", "main")}
            {extraSlots.map((slot) => renderSlot(slot, "section"))}
          </div>
        </div>
        {renderSlot("footer", "footer")}
        {renderSlot("modal", "section")}
      </div>
    )
  }

  if (page.env.layout === "split") {
    return (
      <div className="dsl-split-shell">
        {renderSlot("header", "header")}
        <div className="dsl-split-body">
          {renderSlot("main", "main")}
          {renderSlot("sidebar", "aside")}
        </div>
        {page.env.slots
          .filter((slot) => !["header", "main", "sidebar"].includes(slot))
          .map((slot) => renderSlot(slot, "section"))}
      </div>
    )
  }

  return (
    <div className={page.env.layout === "form" ? "dsl-form-shell" : "dsl-linear-shell"}>
      {page.env.slots.map((slot) => renderSlot(slot, slot === "header" ? "header" : slot === "footer" ? "footer" : "section"))}
    </div>
  )
}
