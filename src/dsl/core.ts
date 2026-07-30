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
  bind?: ComponentBinding
  /**
   * Extra classes appended after the component's own dsl-* classes, so a page
   * can reach a stylesheet that keys on its own names instead of Declaro's.
   *
   * Space-separated, and additive only: the dsl-* classes stay, because the
   * component's own styling comes from them. A page that has to override one
   * writes a more specific rule.
   *
   * Always lands on the component's outermost element, which is where layout
   * classes have to be: a field's class goes on its `dsl-field` label, the grid
   * item a form places, not on the control inside it. This is the opposite of
   * `bind`, which targets the control so `disabled` reaches it. To style the
   * control itself, write a descendant rule: `.my-field input { ... }`.
   */
  className?: string
  /**
   * Extra `data-*` attributes, keyed without the `data-` prefix: `{ action:
   * "stop", pid: "418" }` emits `data-action="stop" data-pid="418"`.
   *
   * This is what lets one island handler serve many controls. A handler receives
   * the DOM event, so it can read `event.target.closest("[data-action]").dataset`
   * and branch on it — without which every row of a table needs its own handler
   * name, and a handler cannot know which row it fired for, since the arguments
   * carry no per-element data.
   *
   * Lands on the same element as `bind`, not `className`: the handler reads these
   * off the event target, so a field's data has to be on its control rather than
   * on the label the click never reaches.
   *
   * Keys must match /^[a-z][a-z0-9-]*$/ — the lowercase, hyphen-separated form
   * HTML wants. `dataset` exposes them camelCased, so `data-out-dir` is read as
   * `dataset.outDir`. A key outside that shape throws at compile time rather than
   * emitting an attribute the browser would silently mangle.
   */
  data?: Record<string, string>
}

/**
 * Reactive bindings for a component inside an Island, compiled to the
 * data-dsl-* attributes the client runtime syncs on every state change.
 *
 * Declaring a binding here is the alternative to hand-writing the element with
 * Html({ html: '<div data-dsl-text="key"></div>' }). It is also the only way to
 * bind a field whose initial value is empty or is a substring of other text,
 * because the compiler's own inference only marks a whole text node that equals
 * a state value.
 *
 * One binding of each kind per component: the runtime reads a single value from
 * each attribute, so a second class or attr binding on the same component would
 * overwrite the first.
 *
 * Which element the attributes land on: the component's own outermost element,
 * except that a field (Input/Select/TextArea) binds its control rather than the
 * surrounding label, since that is what `disabled` has to reach. A Text with
 * titleActions binds the text element, not the title bar around it, so a text
 * binding does not replace its action buttons.
 *
 * Script, Katex and Html ignore bind — Html already writes its own attributes.
 * So does Island: the runtime syncs bindings with querySelectorAll from the
 * island's own element, which does not match that element itself, so a binding
 * declared there would never fire. Bind a component inside the island instead.
 *
 * On a container (Box, Card) `show` and `class` apply to the whole panel, but
 * `text` and `html` replace its children with the state value.
 */
export type ComponentBinding = {
  /** Replaces the element's text with state[key]. */
  text?: string
  /** Replaces the element's inner HTML with state[key]. Not escaped. */
  html?: string
  /** Shows the element while state[key] is truthy, hides it otherwise. */
  show?: string
  /** Toggles a class by the truthiness of state[key]. */
  class?: { cls: string; key: string }
  /**
   * Sets a boolean attribute while state[key] is truthy and removes it
   * otherwise; with `equals`, while String(state[key]) === equals.
   *
   * The attribute's value is always the empty string, which is what a boolean
   * attribute wants. Use attrValue for an attribute whose value is read.
   */
  attr?: { attr: string; key: string; equals?: string }
  /** Writes String(state[key]) into an attribute, removing it when empty. */
  attrValue?: { attr: string; key: string }
  /** Renders state[key] as a list from the element's <template data-dsl-list-item>. */
  list?: string
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
