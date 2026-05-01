import type { Action, ComponentBase } from "../core"

export type SliderValue = number | string

export type SliderOption = {
  label: string
  value: SliderValue
}

export type SliderGranularityRange = {
  from: number
  to: number
  step: number
}

export type SliderInputConfig =
  | boolean
  | {
      min?: number
      max?: number
      step?: number
    }

export type SliderNode = ComponentBase & {
  type: "slider"
  name: string
  label?: string
  min?: number
  max?: number
  step?: number
  granularity?: number | SliderGranularityRange[]
  options?: SliderOption[]
  defaultValue?: SliderValue
  required?: boolean
  showValue?: boolean
  valueType?: "int" | "float" | "enum"
  input?: SliderInputConfig
  snapInput?: boolean
  onChange?: Action
}

export function Slider(config: Omit<SliderNode, "type">): SliderNode {
  return {
    type: "slider",
    min: 0,
    max: 100,
    step: 1,
    showValue: true,
    ...config,
    options: config.options ? [...config.options] : undefined,
  }
}
