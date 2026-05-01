import { useEffect, useState, type ChangeEvent } from "react"
import type { InputNode, SelectNode, SliderNode, SliderOption, SliderValue, TextAreaNode } from "../../../dsl"
import type { RenderContext } from "../types"
import { executeAction } from "../types"

type FieldNode = InputNode | SelectNode | SliderNode | TextAreaNode

type RenderInputProps = {
  node: FieldNode
  ctx: RenderContext
}

export function RenderInput({ node, ctx }: RenderInputProps) {
  if (node.type === "select") {
    return <RenderSelect node={node} ctx={ctx} />
  }

  if (node.type === "textarea") {
    return <RenderTextArea node={node} ctx={ctx} />
  }

  if (node.type === "slider") {
    return <RenderSlider node={node} ctx={ctx} />
  }

  const value = ctx.activeForm?.values[node.name]

  return (
    <label className="dsl-field">
      {node.label && <span>{node.label}</span>}
      <input
        name={node.name}
        placeholder={node.placeholder}
        required={node.required}
        defaultValue={ctx.activeForm ? undefined : node.defaultValue}
        value={ctx.activeForm ? String(value ?? "") : undefined}
        onChange={ctx.activeForm ? (event) => ctx.activeForm?.setValue(node.name, event.target.value) : undefined}
      />
    </label>
  )
}

function RenderSlider({ node, ctx }: { node: SliderNode; ctx: RenderContext }) {
  const resolvedOptions = resolveSliderOptions(node)
  const enumMode = isEnumSlider(node, resolvedOptions)
  const options = enumMode ? resolvedOptions : getNumericSliderOptions(resolvedOptions)
  const fallbackValue = resolveInitialSliderValue(node, options)
  const [localValue, setLocalValue] = useState<SliderValue>(fallbackValue)
  const formValue = ctx.activeForm?.values[node.name]
  const value = isSliderValue(formValue) ? formValue : localValue
  const selectedIndex = findSliderOptionIndex(options, value)
  const selectedOption = options[selectedIndex] ?? options[0]
  const numericBounds = getNumericSliderBounds(options)
  const numericValue = getNumericSliderValue(value, selectedOption, numericBounds)
  const trackValue = enumMode ? selectedIndex : clampNumber(numericValue, numericBounds.min, numericBounds.max)
  const displayValue = enumMode ? formatSliderValue(selectedOption, node) : formatNumberValue(numericValue, node)
  const directInputEnabled = Boolean(node.input)
  const numberInputEnabled = !enumMode && directInputEnabled
  const enumSelectEnabled = enumMode && directInputEnabled
  const showOutput = node.showValue !== false && !directInputEnabled
  const inputBounds = getSliderInputBounds(node, numericBounds)
  const [inputDraft, setInputDraft] = useState(displayValue)

  useEffect(() => {
    setInputDraft(displayValue)
  }, [displayValue])

  const commitValue = (nextValue: SliderValue) => {
    const form = ctx.activeForm
      ? {
          id: ctx.activeForm.id,
          values: {
            ...ctx.activeForm.values,
            [node.name]: nextValue,
          },
          setValue: ctx.activeForm.setValue,
        }
      : undefined

    setLocalValue(nextValue)
    ctx.activeForm?.setValue(node.name, nextValue)
    void executeAction(node.onChange, ctx, node, { form, value: nextValue })
  }

  const commitNumericInput = (rawValue: string) => {
    const trimmedValue = rawValue.trim()

    if (!trimmedValue) {
      setInputDraft(displayValue)
      return
    }

    const parsedValue = Number(trimmedValue)

    if (!Number.isFinite(parsedValue)) {
      setInputDraft(displayValue)
      return
    }

    const normalizedValue = normalizeNumericSliderValue(
      clampNumber(parsedValue, inputBounds.min, inputBounds.max),
      node,
    )
    const nextValue = node.snapInput === false ? normalizedValue : findNearestSliderValue(options, normalizedValue)

    setInputDraft(formatNumberValue(nextValue, node))
    commitValue(nextValue)
  }

  return (
    <div className="dsl-field dsl-slider-field">
      <span className="dsl-slider-label">
        {node.label && <span>{node.label}</span>}
        {showOutput && <output>{displayValue}</output>}
      </span>
      <div className={["dsl-slider-control", directInputEnabled ? "dsl-slider-control-with-input" : undefined].filter(Boolean).join(" ")}>
        <input
          name={node.name}
          type="range"
          min={enumMode ? 0 : numericBounds.min}
          max={enumMode ? Math.max(options.length - 1, 0) : numericBounds.max}
          step={enumMode ? 1 : node.snapInput === false ? "any" : getNumericTrackStep(node)}
          required={node.required}
          value={trackValue}
          onChange={(event) => {
            const rawValue = Number(event.target.value)
            const nextValue = enumMode
              ? (options[rawValue] ?? options[0]).value
              : findNearestSliderValue(options, rawValue)

            commitValue(nextValue)
          }}
        />
        {numberInputEnabled && (
          <input
            aria-label={node.label ?? node.name}
            className="dsl-slider-number-input"
            type="number"
            inputMode={node.valueType === "int" ? "numeric" : "decimal"}
            min={inputBounds.min}
            max={inputBounds.max}
            step={getSliderNumberInputStep(node, options)}
            value={inputDraft}
            onChange={(event) => setInputDraft(event.target.value)}
            onBlur={(event) => commitNumericInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitNumericInput(event.currentTarget.value)
                event.currentTarget.blur()
              }
            }}
          />
        )}
        {enumSelectEnabled && (
          <select
            aria-label={node.label ?? node.name}
            className="dsl-slider-select-input"
            value={String(selectedIndex)}
            onChange={(event) => {
              const nextOption = options[Number(event.target.value)] ?? options[0]
              commitValue(nextOption.value)
            }}
          >
            {options.map((option, index) => (
              <option key={`${option.value}-${index}`} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

function RenderSelect({ node, ctx }: { node: SelectNode; ctx: RenderContext }) {
  const value = ctx.activeForm?.values[node.name]

  return (
    <label className="dsl-field">
      {node.label && <span>{node.label}</span>}
      <select
        name={node.name}
        multiple={node.multiple}
        required={node.required}
        value={ctx.activeForm ? selectValue(node, value) : undefined}
        onChange={ctx.activeForm ? (event) => ctx.activeForm?.setValue(node.name, readSelectValue(event, node)) : undefined}
      >
        {!node.multiple && <option value="">请选择</option>}
        {node.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RenderTextArea({ node, ctx }: { node: TextAreaNode; ctx: RenderContext }) {
  const value = ctx.activeForm?.values[node.name]

  return (
    <label className="dsl-field">
      {node.label && <span>{node.label}</span>}
      <textarea
        name={node.name}
        placeholder={node.placeholder}
        required={node.required}
        rows={node.rows ?? 3}
        value={ctx.activeForm ? String(value ?? "") : undefined}
        onChange={ctx.activeForm ? (event) => ctx.activeForm?.setValue(node.name, event.target.value) : undefined}
      />
    </label>
  )
}

function selectValue(node: SelectNode, value: unknown): string | string[] {
  if (node.multiple) {
    return Array.isArray(value) ? value.map(String) : []
  }

  return String(value ?? "")
}

function readSelectValue(event: ChangeEvent<HTMLSelectElement>, node: SelectNode): string | string[] {
  if (!node.multiple) {
    return event.target.value
  }

  return Array.from(event.target.selectedOptions).map((option) => option.value)
}

function resolveSliderOptions(node: SliderNode): SliderOption[] {
  if (node.options?.length) {
    return node.options.map((option) => ({
      label: option.label,
      value: option.value,
    }))
  }

  return generateNumericSliderOptions(node)
}

function isEnumSlider(node: SliderNode, options: readonly SliderOption[]): boolean {
  return node.valueType === "enum" || options.some((option) => typeof option.value === "string")
}

function getNumericSliderOptions(options: readonly SliderOption[]): SliderOption[] {
  return options
    .filter((option): option is SliderOption & { value: number } => typeof option.value === "number")
    .sort((left, right) => left.value - right.value)
}

function getNumericSliderBounds(options: readonly SliderOption[]): { min: number; max: number } {
  const numericValues = options.map((option) => option.value).filter((value): value is number => typeof value === "number")

  if (numericValues.length === 0) {
    return { min: 0, max: 100 }
  }

  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  }
}

function getNumericTrackStep(node: SliderNode): number | "any" {
  if (Array.isArray(node.granularity)) {
    return "any"
  }

  return node.granularity ?? node.step ?? 1
}

function getSliderInputBounds(
  node: SliderNode,
  numericBounds: { min: number; max: number },
): { min: number; max: number } {
  const inputConfig = typeof node.input === "object" ? node.input : undefined
  const min = Math.max(inputConfig?.min ?? numericBounds.min, numericBounds.min)
  const max = Math.min(inputConfig?.max ?? numericBounds.max, numericBounds.max)

  if (min > max) {
    return numericBounds
  }

  return { min, max }
}

function getSliderNumberInputStep(node: SliderNode, options: readonly SliderOption[]): number | "any" {
  const inputConfig = typeof node.input === "object" ? node.input : undefined

  if (inputConfig?.step !== undefined) {
    return Math.abs(inputConfig.step) || "any"
  }

  if (node.valueType === "int") {
    return 1
  }

  if (node.snapInput === false) {
    return "any"
  }

  const trackStep = getNumericTrackStep(node)
  if (trackStep !== "any") {
    return trackStep
  }

  return getSmallestNumericStep(options) ?? "any"
}

function getSmallestNumericStep(options: readonly SliderOption[]): number | undefined {
  const numericValues = options
    .map((option) => option.value)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right)
  let smallestStep: number | undefined

  for (let index = 1; index < numericValues.length; index += 1) {
    const step = numericValues[index] - numericValues[index - 1]

    if (step > 0 && (smallestStep === undefined || step < smallestStep)) {
      smallestStep = step
    }
  }

  return smallestStep
}

function generateNumericSliderOptions(node: SliderNode): SliderOption[] {
  const min = node.min ?? 0
  const max = node.max ?? 100

  if (Array.isArray(node.granularity)) {
    return generateSegmentedNumericOptions(node.granularity, node)
  }

  const step = node.granularity ?? node.step ?? 1
  return generateNumericRangeOptions(min, max, step, node)
}

function generateSegmentedNumericOptions(ranges: NonNullable<SliderNode["granularity"]>, node: SliderNode): SliderOption[] {
  if (!Array.isArray(ranges)) {
    return []
  }

  const options: SliderOption[] = []
  const seen = new Set<string>()

  for (const range of ranges) {
    for (const value of generateNumericValues(range.from, range.to, range.step, node)) {
      const key = String(value)

      if (!seen.has(key)) {
        seen.add(key)
        options.push({
          label: formatNumberValue(value, node),
          value,
        })
      }
    }
  }

  return options.length > 0 ? options : generateNumericRangeOptions(node.min ?? 0, node.max ?? 100, node.step ?? 1, node)
}

function generateNumericRangeOptions(min: number, max: number, step: number, node: SliderNode): SliderOption[] {
  return generateNumericValues(min, max, step, node).map((value) => ({
    label: formatNumberValue(value, node),
    value,
  }))
}

function generateNumericValues(min: number, max: number, step: number, node: SliderNode): number[] {
  const safeStep = Math.abs(step) || 1
  const precision = Math.max(decimalPlaces(safeStep), decimalPlaces(min), decimalPlaces(max))
  const values: number[] = []

  for (let value = min; value <= max + safeStep / 1_000_000; value += safeStep) {
    const normalizedValue = normalizeNumericSliderValue(roundToPrecision(value, precision), node)
    const previousValue = values[values.length - 1]

    if (previousValue !== normalizedValue) {
      values.push(normalizedValue)
    }
  }

  const normalizedMax = normalizeNumericSliderValue(roundToPrecision(max, precision), node)
  if (values[values.length - 1] !== normalizedMax) {
    values.push(normalizedMax)
  }

  return values
}

function resolveInitialSliderValue(node: SliderNode, options: readonly SliderOption[]): SliderValue {
  if (node.defaultValue !== undefined) {
    if (node.snapInput === false && typeof node.defaultValue === "number") {
      const bounds = getNumericSliderBounds(options)
      return normalizeNumericSliderValue(clampNumber(node.defaultValue, bounds.min, bounds.max), node)
    }

    return findNearestSliderValue(options, node.defaultValue)
  }

  return options[0]?.value ?? 0
}

function getNumericSliderValue(
  value: SliderValue,
  selectedOption: SliderOption | undefined,
  numericBounds: { min: number; max: number },
): number {
  if (typeof value === "number") {
    return value
  }

  if (typeof selectedOption?.value === "number") {
    return selectedOption.value
  }

  return numericBounds.min
}

function findNearestSliderValue(options: readonly SliderOption[], value: SliderValue): SliderValue {
  const exactOption = options.find((option) => isSameSliderValue(option.value, value))

  if (exactOption) {
    return exactOption.value
  }

  if (typeof value !== "number") {
    return options[0]?.value ?? value
  }

  const nearestOption = options.reduce<SliderOption | undefined>((nearest, option) => {
    if (typeof option.value !== "number") {
      return nearest
    }

    if (!nearest || typeof nearest.value !== "number") {
      return option
    }

    return Math.abs(option.value - value) < Math.abs(nearest.value - value) ? option : nearest
  }, undefined)

  return nearestOption?.value ?? options[0]?.value ?? value
}

function findSliderOptionIndex(options: readonly SliderOption[], value: SliderValue): number {
  const exactIndex = options.findIndex((option) => isSameSliderValue(option.value, value))

  if (exactIndex >= 0) {
    return exactIndex
  }

  const nearestValue = findNearestSliderValue(options, value)
  return Math.max(
    options.findIndex((option) => isSameSliderValue(option.value, nearestValue)),
    0,
  )
}

function normalizeNumericSliderValue(value: number, node: SliderNode): number {
  if (node.valueType === "int") {
    return Math.round(value)
  }

  return value
}

function formatSliderValue(option: SliderOption | undefined, node: SliderNode): string {
  if (!option) {
    return ""
  }

  if (node.valueType === "enum" || typeof option.value === "string") {
    return option.label
  }

  return option.label || formatNumberValue(option.value, node)
}

function formatNumberValue(value: SliderValue, node: SliderNode): string {
  if (typeof value !== "number") {
    return String(value)
  }

  if (node.valueType === "int" || Number.isInteger(value)) {
    return String(Math.round(value))
  }

  return String(value)
}

function isSliderValue(value: unknown): value is SliderValue {
  return typeof value === "number" || typeof value === "string"
}

function isSameSliderValue(left: SliderValue, right: SliderValue): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 1e-9
  }

  return left === right
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundToPrecision(value: number, precision: number): number {
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

function decimalPlaces(value: number): number {
  const normalized = String(value)

  if (!normalized.includes(".")) {
    return 0
  }

  return normalized.split(".")[1]?.length ?? 0
}
