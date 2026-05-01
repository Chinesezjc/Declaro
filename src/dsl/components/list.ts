import type { ComponentBase, ContentAlignX, ContentAlignY, SizeMode } from "../core"
import type { ComponentNode } from "../component"

export type ListItem = Record<string, unknown>

export type ListRenderMeta<TItem extends ListItem> = {
  index: number
  items: TItem[]
}

export type ListNode = ComponentBase & {
  type: "list"
  dataSource?: string
  items?: ListItem[]
  itemKey?: string | ((item: ListItem, index: number) => string)
  gap?: number | string
  childrenAlignX?: ContentAlignX
  childrenAlignY?: ContentAlignY
  childrenSizeX?: SizeMode
  childrenSizeY?: SizeMode
  loading?: ComponentNode[]
  empty?: ComponentNode[]
  renderItem: (item: ListItem, meta: ListRenderMeta<ListItem>) => ComponentNode
}

export type ListConfig<TItem extends ListItem = ListItem> = Omit<ListNode, "type" | "items" | "itemKey" | "renderItem"> & {
  items?: TItem[]
  itemKey?: keyof TItem | ((item: TItem, index: number) => string)
  renderItem: (item: TItem, meta: ListRenderMeta<TItem>) => ComponentNode
}

export function List<TItem extends ListItem = ListItem>(config: ListConfig<TItem>): ListNode {
  return {
    type: "list",
    ...config,
    items: config.items ? [...config.items] : undefined,
    itemKey: normalizeItemKey(config.itemKey),
    loading: config.loading ? [...config.loading] : undefined,
    empty: config.empty ? [...config.empty] : undefined,
    renderItem: (item, meta) => config.renderItem(item as TItem, meta as ListRenderMeta<TItem>),
  }
}

function normalizeItemKey<TItem extends ListItem>(
  itemKey: ListConfig<TItem>["itemKey"],
): ListNode["itemKey"] {
  if (!itemKey) {
    return undefined
  }

  if (typeof itemKey === "function") {
    return (item, index) => itemKey(item as TItem, index)
  }

  return String(itemKey)
}
