import { Fragment, useMemo, useState } from "react"
import type { ComponentNode, FormNode } from "../../../dsl"
import type { ComponentRenderer, RenderContext } from "../types"
import { executeAction, withSignalHandler } from "../types"
import { RenderButton } from "./RenderButton"
import { getComponentRenderKey } from "../renderKeys"

type RenderFormProps = {
  node: FormNode
  ctx: RenderContext
  renderNode: ComponentRenderer
}

export function RenderForm({ node, ctx, renderNode }: RenderFormProps) {
  const initialValues = useMemo(() => createInitialValues(node.fields), [node.fields])
  const [values, setValues] = useState<Record<string, unknown>>(initialValues)

  const baseFormCtx: RenderContext = {
    ...ctx,
    activeForm: {
      id: node.id,
      values,
      setValue: (name, value) => {
        setValues((currentValues) => ({
          ...currentValues,
          [name]: value,
        }))
      },
    },
  }
  const formCtx = withSignalHandler(baseFormCtx, node.onSignal, node)

  return (
    <form
      id={node.id}
      className="dsl-form"
      onSubmit={(event) => {
        event.preventDefault()

        if (!event.currentTarget.checkValidity()) {
          event.currentTarget.reportValidity()
          return
        }

        const form = { id: node.id, values: { ...values } }
        void executeAction(node.onSubmit, formCtx, node, { form })
        void executeAction(node.submitButton?.onClick, formCtx, node.submitButton, { form })
      }}
    >
      <div className="dsl-form-fields">
        {node.fields.map((field, index) => (
          <Fragment key={getComponentRenderKey(field, index, "form-field")}>
            {renderNode(field, formCtx)}
          </Fragment>
        ))}
      </div>
      {(node.submitButton || node.onSubmit) && (
        <div className="dsl-form-actions">
          {node.submitButton ? (
            <RenderButton node={node.submitButton} ctx={formCtx} type="submit" executeClickAction={false} />
          ) : (
            <button className="dsl-button dsl-button-primary" type="submit">
              提交
            </button>
          )}
        </div>
      )}
    </form>
  )
}

function createInitialValues(fields: readonly ComponentNode[]): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((values, field) => {
    switch (field.type) {
      case "input":
        values[field.name] = field.defaultValue ?? ""
        break
      case "select":
        values[field.name] = field.multiple ? [] : ""
        break
      case "slider":
        values[field.name] = field.defaultValue ?? field.options?.[0]?.value ?? field.min ?? 0
        break
      case "textarea":
        values[field.name] = ""
        break
      default:
        break
    }

    return values
  }, {})
}
