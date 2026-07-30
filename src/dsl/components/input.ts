import type { ComponentBase } from "../core"

/**
 * Value of the HTML `type` attribute.
 *
 * The list is closed on purpose: `checkbox` and `radio` need a different label
 * layout than dsl-field provides, and `submit`/`button`/`image` are Button's job.
 */
export type InputType =
  | "text"
  | "password"
  | "email"
  | "number"
  | "tel"
  | "url"
  | "search"
  | "date"
  | "time"
  | "datetime-local"
  | "month"
  | "week"
  | "color"
  | "file"
  | "hidden"

export type InputNode = ComponentBase & {
  type: "input"
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  /** HTML input type. Defaults to text. */
  inputType?: InputType
  /** Restricts the file picker, and only has an effect when inputType is "file". */
  accept?: string
  /** Virtual keyboard hint, e.g. "numeric" for a digits-only field. */
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url"
  /** Client-side validation pattern, as an HTML pattern attribute. */
  pattern?: string
  /** Browser autofill hint; "off" opts a field out. */
  autoComplete?: string
  /** Enclosing Island handler to invoke, and on which DOM event. */
  islandHandler?: string
  islandEvent?: "input" | "change" | "keydown"
}

export function Input(config: Omit<InputNode, "type">): InputNode {
  return {
    type: "input",
    ...config,
  }
}
