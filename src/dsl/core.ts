import type { Role, RuntimeUser, SlotName } from "../types/common"

export type { Role, RuntimeUser, SlotName } from "../types/common"

export type ComponentBase = {
  id?: string
  slot?: SlotName
  order?: number
  visible?: boolean
  roles?: Role[]
  meta?: Record<string, unknown>
  alignX?: AlignX
  alignY?: AlignY
  sizeX?: SizeMode
  sizeY?: SizeMode
}

export type AlignX = "left" | "center" | "right" | "stretch"

export type AlignY = "top" | "center" | "bottom" | "stretch"

export type ContentAlignX = AlignX | "space-between" | "space-around" | "space-evenly"

export type ContentAlignY = AlignY | "space-between" | "space-around" | "space-evenly"

export type SizeMode = "hug" | "fill"

export type ToastAnimation = "fade-right" | "fade-up" | "pop" | "none"

export type ToastVariant = "info" | "success" | "warning" | "danger"

export type ToastOptions = {
  key?: string
  duration?: number
  animation?: ToastAnimation
  variant?: ToastVariant
  className?: string
}

export type ComponentSignal = {
  type: string
  sourceId?: string
  value?: unknown
  payload?: Record<string, unknown>
}

export type RequestClient = {
  get: <T = unknown>(url: string) => Promise<T>
  post: <T = unknown>(url: string, body?: unknown) => Promise<T>
  put: <T = unknown>(url: string, body?: unknown) => Promise<T>
  delete: <T = unknown>(url: string) => Promise<T>
}

export type ActionContext = {
  pageId?: string
  componentId?: string
  componentMeta?: Record<string, unknown>
  user?: RuntimeUser
  row?: Record<string, unknown>
  value?: unknown
  signal?: ComponentSignal
  form?: {
    id: string
    values: Record<string, unknown>
    setValue?: (name: string, value: unknown) => void
  }
  request: RequestClient
  emitSignal: (signal: ComponentSignal) => void | Promise<void>
  toast: (message: string, options?: ToastOptions) => void
  refresh: () => void
  navigate: (path: string) => void
  openModal: (id: string) => void
  closeModal: (id: string) => void
}

export type Action = (ctx: ActionContext) => void | Promise<void>
