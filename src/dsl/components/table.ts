import type { ComponentBase } from "../core"
import type { ComponentNode } from "../component"
import type { ButtonNode } from "./button"

export type ColumnNode = {
  key: string
  title: string
  width?: number
  sortable?: boolean
  sortValue?: (row: Record<string, unknown>) => unknown
  render?: (value: unknown, row: Record<string, unknown>) => unknown
}

export type SortDirection = "asc" | "desc"

export type TableSortConfig = {
  key: string
  direction?: SortDirection
}

export function Column(key: string, title: string, config?: Omit<ColumnNode, "key" | "title">): ColumnNode {
  return {
    key,
    title,
    ...config,
  }
}

export type TableNode = ComponentBase & {
  type: "table"
  title?: string
  titleActions?: ComponentNode[]
  dataSource: string
  columns: ColumnNode[]
  defaultSort?: TableSortConfig | TableSortConfig[]
  rowActions?: ButtonNode[]
}

export function Table(config: Omit<TableNode, "type">): TableNode {
  return {
    type: "table",
    ...config,
    titleActions: config.titleActions ? [...config.titleActions] : undefined,
    columns: [...config.columns],
    rowActions: config.rowActions ? [...config.rowActions] : undefined,
  }
}
