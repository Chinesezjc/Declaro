import React, { useEffect, useMemo, useRef, useState } from "react"
import type { ColumnNode, SortDirection, TableNode } from "../../../dsl"
import type { ComponentRenderer, RenderContext } from "../types"
import { getComponentRenderKey } from "../renderKeys"
import { RenderButton } from "./RenderButton"

type RenderTableProps = {
  node: TableNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

type Row = Record<string, unknown>

type SortCriterion = {
  key: string
  direction: SortDirection
}

export function RenderTable({ node, ctx, renderNode }: RenderTableProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [sortStack, setSortStack] = useState<SortCriterion[]>(() => normalizeDefaultSort(node.defaultSort))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasRowsRef = useRef(false)
  const loadedDataSourceRef = useRef<string | undefined>(undefined)
  const hasActions = Boolean(node.rowActions?.length)
  const titleActions = node.titleActions ?? []
  const hasTitlebar = Boolean(node.title) || titleActions.length > 0
  const sortedRows = useMemo(() => sortRows(rows, node.columns, sortStack), [node.columns, rows, sortStack])

  useEffect(() => {
    let active = true
    const canRefreshInBackground = loadedDataSourceRef.current === node.dataSource && hasRowsRef.current

    setLoading(!canRefreshInBackground)
    setError(null)

    ctx.request
      .get<unknown>(node.dataSource)
      .then((result) => {
        if (active) {
          const nextRows = normalizeRows(result)
          setRows(nextRows)
          hasRowsRef.current = nextRows.length > 0
          loadedDataSourceRef.current = node.dataSource
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          const message = requestError instanceof Error ? requestError.message : "数据加载失败"
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
  }, [ctx.request, ctx.toast, node.dataSource])

  return (
    <section className="dsl-table-card">
      {hasTitlebar && (
        <div className="dsl-titlebar">
          {node.title && <h2>{node.title}</h2>}
          {titleActions.length > 0 && (
            <div className="dsl-title-actions">
              {titleActions.map((action, index) => (
                <React.Fragment key={getComponentRenderKey(action, index, "table-title-action")}>
                  {renderNode(action, ctx)}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="dsl-table-wrap">
        <table className="dsl-table">
          <thead>
            <tr>
              {node.columns.map((column) => (
                <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                  {column.sortable ? (
                    <button
                      className="dsl-table-sort"
                      type="button"
                      aria-sort={getAriaSort(column, sortStack)}
                      onClick={() => setSortStack((currentStack) => getNextSortStack(currentStack, column.key))}
                    >
                      <span>{column.title}</span>
                      <span aria-hidden="true">{getSortMark(column, sortStack)}</span>
                    </button>
                  ) : (
                    column.title
                  )}
                </th>
              ))}
              {hasActions && <th>操作</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={node.columns.length + (hasActions ? 1 : 0)}>加载中...</td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={node.columns.length + (hasActions ? 1 : 0)}>{error}</td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={node.columns.length + (hasActions ? 1 : 0)}>暂无数据</td>
              </tr>
            )}
            {!loading &&
              !error &&
              sortedRows.map((row, rowIndex) => (
                <tr key={String(row.id ?? rowIndex)}>
                  {node.columns.map((column) => (
                    <td key={column.key}>{renderCell(column.render ? column.render(row[column.key], row) : row[column.key])}</td>
                  ))}
                  {hasActions && (
                    <td>
                      <div className="dsl-row-actions">
                        {node.rowActions?.map((action, actionIndex) => (
                          <RenderButton key={action.id ?? `${action.text}-${actionIndex}`} node={action} ctx={ctx} row={row} />
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function normalizeDefaultSort(defaultSort: TableNode["defaultSort"]): SortCriterion[] {
  if (!defaultSort) {
    return []
  }

  const entries = Array.isArray(defaultSort) ? defaultSort : [defaultSort]

  return entries.map((entry) => ({
    key: entry.key,
    direction: entry.direction ?? "asc",
  }))
}

function getNextSortStack(currentStack: readonly SortCriterion[], key: string): SortCriterion[] {
  const [primarySort] = currentStack
  const remainingSorts = currentStack.filter((sort) => sort.key !== key)

  if (!primarySort || primarySort.key !== key) {
    return [{ key, direction: "asc" }, ...remainingSorts]
  }

  if (primarySort.direction === "asc") {
    return [{ key, direction: "desc" }, ...remainingSorts]
  }

  return remainingSorts
}

function getSortMark(column: ColumnNode, sortStack: readonly SortCriterion[]): string {
  const sortIndex = sortStack.findIndex((sort) => sort.key === column.key)

  if (sortIndex === -1) {
    return "↕"
  }

  const direction = sortStack[sortIndex].direction === "asc" ? "↑" : "↓"
  return sortStack.length > 1 ? `${direction}${sortIndex + 1}` : direction
}

function getAriaSort(column: ColumnNode, sortStack: readonly SortCriterion[]): "ascending" | "descending" | "none" {
  const sort = sortStack.find((candidate) => candidate.key === column.key)

  if (!sort) {
    return "none"
  }

  return sort.direction === "asc" ? "ascending" : "descending"
}

function sortRows(rows: readonly Row[], columns: readonly ColumnNode[], sortStack: readonly SortCriterion[]): Row[] {
  const sortableStack = sortStack
    .map((sort) => ({
      ...sort,
      column: columns.find((candidate) => candidate.key === sort.key),
    }))
    .filter((sort): sort is SortCriterion & { column: ColumnNode } => Boolean(sort.column))

  if (sortableStack.length === 0) {
    return [...rows]
  }

  return [...sortableStack]
    .reverse()
    .reduce((sortedRows, sort) => stableSortByColumn(sortedRows, sort.column, sort.direction), [...rows])
}

function stableSortByColumn(rows: Row[], column: ColumnNode, direction: SortDirection): Row[] {
  const multiplier = direction === "asc" ? 1 : -1

  return [...rows].sort((left, right) => {
    return compareValues(readSortValue(column, left), readSortValue(column, right)) * multiplier
  })
}

function readSortValue(column: ColumnNode, row: Row): unknown {
  return column.sortValue ? column.sortValue(row) : row[column.key]
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0
  }

  if (left === null || left === undefined) {
    return 1
  }

  if (right === null || right === undefined) {
    return -1
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right)
  }

  return new Intl.Collator("zh-CN", {
    numeric: true,
    sensitivity: "base",
  }).compare(String(left), String(right))
}

function normalizeRows(result: unknown): Row[] {
  if (Array.isArray(result)) {
    return result.filter(isRow)
  }

  if (isRow(result)) {
    const data = result.data
    const items = result.items
    const rows = result.rows

    if (Array.isArray(data)) {
      return data.filter(isRow)
    }

    if (Array.isArray(items)) {
      return items.filter(isRow)
    }

    if (Array.isArray(rows)) {
      return rows.filter(isRow)
    }
  }

  return []
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function renderCell(value: unknown): React.ReactNode {
  if (React.isValidElement(value)) {
    return value
  }

  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否"
  }

  return JSON.stringify(value)
}
