import type React from "react"
import type { Action, ActionContext, ComponentNode, ComponentSignal, RequestClient, RuntimeUser, SizeMode } from "../../dsl"

type ActionTarget =
  | string
  | {
      id?: string
      meta?: Record<string, unknown>
    }

export type RuntimeContext = {
  user?: RuntimeUser
  request: RequestClient
  toast: ActionContext["toast"]
  refresh: ActionContext["refresh"]
  navigate: ActionContext["navigate"]
  openModal: ActionContext["openModal"]
  closeModal: ActionContext["closeModal"]
}

export type ActiveFormState = {
  id: string
  values: Record<string, unknown>
  setValue: (name: string, value: unknown) => void
}

export type RenderContext = RuntimeContext & {
  pageId?: string
  row?: Record<string, unknown>
  activeForm?: ActiveFormState
  emitSignal?: (signal: ComponentSignal) => void | Promise<void>
}

export type ParentSizing = {
  sizeX?: SizeMode
  sizeY?: SizeMode
}

export type ComponentRenderer = (component: ComponentNode, ctx: RenderContext, parentSizing?: ParentSizing) => React.ReactNode

export function createDefaultRuntimeContext(): RuntimeContext {
  return {
    request: createFetchRequestClient(),
    toast: (message) => window.alert(message),
    refresh: () => window.location.reload(),
    navigate: (path) => {
      window.history.pushState({}, "", path)
    },
    openModal: (id) => {
      window.dispatchEvent(new CustomEvent("dsl:open-modal", { detail: { id } }))
    },
    closeModal: (id) => {
      window.dispatchEvent(new CustomEvent("dsl:close-modal", { detail: { id } }))
    },
  }
}

export function createActionContext(
  ctx: RenderContext,
  component?: ActionTarget,
  overrides: Partial<Pick<ActionContext, "componentMeta" | "form" | "pageId" | "row" | "signal" | "value">> = {},
): ActionContext {
  const componentId = typeof component === "string" ? component : component?.id
  const componentMeta = typeof component === "string" ? undefined : component?.meta

  return {
    request: ctx.request,
    toast: ctx.toast,
    refresh: ctx.refresh,
    navigate: ctx.navigate,
    openModal: ctx.openModal,
    closeModal: ctx.closeModal,
    user: ctx.user,
    pageId: overrides.pageId ?? ctx.pageId,
    componentId,
    componentMeta: overrides.componentMeta ?? componentMeta,
    row: overrides.row ?? ctx.row,
    value: overrides.value,
    signal: overrides.signal,
    form: overrides.form ?? formFromContext(ctx),
    emitSignal: (signal) => {
      return ctx.emitSignal?.({
        ...signal,
        sourceId: signal.sourceId ?? componentId,
      })
    },
  }
}

export async function executeAction(
  action: Action | undefined,
  ctx: RenderContext,
  component?: ActionTarget,
  overrides?: Partial<Pick<ActionContext, "componentMeta" | "form" | "pageId" | "row" | "signal" | "value">>,
): Promise<void> {
  if (!action) {
    return
  }

  try {
    await action(createActionContext(ctx, component, overrides))
  } catch (error) {
    ctx.toast(error instanceof Error ? error.message : "操作失败")
  }
}

export function withSignalHandler(ctx: RenderContext, onSignal: Action | undefined, component?: ActionTarget): RenderContext {
  if (!onSignal) {
    return ctx
  }

  return {
    ...ctx,
    emitSignal: (signal) => executeAction(onSignal, ctx, component, { signal }),
  }
}

function formFromContext(ctx: RenderContext): ActionContext["form"] {
  if (!ctx.activeForm) {
    return undefined
  }

  return {
    id: ctx.activeForm.id,
    values: { ...ctx.activeForm.values },
    setValue: ctx.activeForm.setValue,
  }
}

function createFetchRequestClient(): RequestClient {
  return {
    get: async <T = unknown>(url: string) => {
      const response = await fetch(url)
      return parseResponse<T>(response)
    },
    post: <T = unknown>(url: string, body?: unknown) => requestWithBody<T>("POST", url, body),
    put: <T = unknown>(url: string, body?: unknown) => requestWithBody<T>("PUT", url, body),
    delete: async <T = unknown>(url: string) => {
      const response = await fetch(url, { method: "DELETE" })
      return parseResponse<T>(response)
    },
  }
}

async function requestWithBody<T>(method: "POST" | "PUT", url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return parseResponse<T>(response)
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
