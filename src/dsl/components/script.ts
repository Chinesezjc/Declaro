import type { ComponentBase } from "../core"

export type ScriptNode = ComponentBase & {
  type: "script"
  src?: string
  inline?: string
  async?: boolean
  defer?: boolean
  type_?: string  // "module" | "text/javascript" etc
}

export function Script(config: Omit<ScriptNode, "type">): ScriptNode {
  return { type: "script", ...config }
}
