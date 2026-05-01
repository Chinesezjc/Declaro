import React, { useEffect, useRef, useState, type CSSProperties } from "react"
import type { ListItem, ListNode } from "../../../dsl"
import { getContentAlignmentStyle } from "../alignment"
import { getComponentRenderKey } from "../renderKeys"
import type { ComponentRenderer, RenderContext } from "../types"

type RenderListProps = {
  node: ListNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

export function RenderList({ node, ctx, renderNode }: RenderListProps) {
  const [items, setItems] = useState<ListItem[]>(node.items ?? [])
  const [loading, setLoading] = useState(Boolean(node.dataSource))
  const [error, setError] = useState<string | null>(null)
  const hasContentRef = useRef((node.items ?? []).length > 0)
  const loadedDataSourceRef = useRef<string | undefined>(node.dataSource ? undefined : "inline")
  const listStyle: CSSProperties = {
    gap: typeof node.gap === "number" ? `${node.gap}px` : node.gap,
    ...getContentAlignmentStyle(node.childrenAlignX, node.childrenAlignY),
  }

  useEffect(() => {
    if (!node.dataSource) {
      setItems(node.items ?? [])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    const canRefreshInBackground = loadedDataSourceRef.current === node.dataSource && hasContentRef.current

    setLoading(!canRefreshInBackground)
    setError(null)

    ctx.request
      .get<unknown>(node.dataSource)
      .then((result) => {
        if (active) {
          const nextItems = normalizeItems(result)
          setItems(nextItems)
          hasContentRef.current = nextItems.length > 0
          loadedDataSourceRef.current = node.dataSource
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          const message = requestError instanceof Error ? requestError.message : "列表数据加载失败"
          if (!canRefreshInBackground) {
            setError(message)
          }
          ctx.toast(message)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [ctx.request, ctx.toast, node.dataSource, node.items])

  if (loading) {
    return (
      <section className="dsl-list">
        <div className="dsl-list-items" style={listStyle}>
          {node.loading?.length
            ? node.loading.map((child, index) => (
                <React.Fragment key={getComponentRenderKey(child, index, "list-loading")}>
                  {renderNode(child, ctx)}
                </React.Fragment>
              ))
            : renderNode({ type: "text", text: "加载中...", variant: "caption" }, ctx)}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="dsl-list">
        <div className="dsl-list-items" style={listStyle}>
          {renderNode({ type: "text", text: error, variant: "caption" }, ctx)}
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="dsl-list">
        <div className="dsl-list-items" style={listStyle}>
          {node.empty?.length
            ? node.empty.map((child, index) => (
                <React.Fragment key={getComponentRenderKey(child, index, "list-empty")}>
                  {renderNode(child, ctx)}
                </React.Fragment>
              ))
            : renderNode({ type: "text", text: "暂无数据", variant: "caption" }, ctx)}
        </div>
      </section>
    )
  }

  return (
    <section className="dsl-list">
      <div className="dsl-list-items" style={listStyle}>
        {items.map((item, index) => {
          const child = node.renderItem(item, { index, items })

          return (
            <React.Fragment key={resolveItemKey(node, item, index)}>
              {renderNode(child, ctx, {
                sizeX: node.childrenSizeX,
                sizeY: node.childrenSizeY,
              })}
            </React.Fragment>
          )
        })}
      </div>
    </section>
  )
}

function normalizeItems(result: unknown): ListItem[] {
  if (Array.isArray(result)) {
    return result.filter(isListItem)
  }

  if (isListItem(result)) {
    if (Array.isArray(result.data)) {
      return result.data.filter(isListItem)
    }

    if (Array.isArray(result.items)) {
      return result.items.filter(isListItem)
    }

    if (Array.isArray(result.rows)) {
      return result.rows.filter(isListItem)
    }
  }

  return []
}

function isListItem(value: unknown): value is ListItem {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function resolveItemKey(node: ListNode, item: ListItem, index: number): string {
  if (typeof node.itemKey === "function") {
    return node.itemKey(item, index)
  }

  if (node.itemKey) {
    return String(item[node.itemKey] ?? index)
  }

  return String(item.id ?? index)
}
