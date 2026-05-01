export type EnvConfig = {
  id: string
  layout: "default" | "dashboard" | "form" | "split" | "custom"
  slots: string[]
}

export type EnvNode = {
  type: "env"
  id: string
  layout: EnvConfig["layout"]
  slots: string[]
}

export function Env(config: EnvConfig): EnvNode {
  return {
    type: "env",
    id: config.id,
    layout: config.layout,
    slots: [...config.slots],
  }
}
