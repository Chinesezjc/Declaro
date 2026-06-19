// Reverse adapter: compile Declaro DSL → React components.
// Lets you use Declaro pages in Next.js, Remix, or any React project.
//
// @example
// ```tsx
// // app/page.tsx in Next.js
// import { compileToReact } from "declaro/adapter/react"
// import { MyPage } from "@/declaro/myPage"
//
// export default function HomePage() {
//   return <main>{compileToReact(MyPage)}</main>
// }
// ```

import { createElement, type ReactNode } from "react"
import type { PageNode, ComponentNode } from "../../dsl"
import { renderComponent } from "../../renderer/react/renderComponent"
import type { RenderContext } from "../../renderer/react/types"

export interface CompileToReactOptions {
  /** Override page title (sets document.title) */
  title?: string
  /** Request client for data fetching actions */
  request?: RenderContext["request"]
  /** Navigation handler (use next/navigation or remix navigate) */
  navigate?: (path: string) => void
  /** Current user info */
  user?: RenderContext["user"]
  /** Base path for routing */
  basePath?: string
}

/**
 * Compile a Declaro PageNode or ComponentNode tree into React elements.
 *
 * Returns a React fragment that can be rendered in any React app.
 * The existing Declaro React renderer handles all the heavy lifting.
 */
export function compileToReact(page: PageNode, options: CompileToReactOptions = {}): ReactNode {
  const ctx: RenderContext = {
    user: options.user ?? { id: "anonymous", role: "admin", name: "Anonymous" },
    request: options.request ?? {
      get: async <T = unknown>(url: string): Promise<T> => {
        const res = await fetch(url)
        return res.json()
      },
      post: async <T = unknown>(url: string, body?: unknown): Promise<T> => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        })
        return res.json()
      },
      put: async <T = unknown>(url: string, body?: unknown): Promise<T> => {
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        })
        return res.json()
      },
      delete: async <T = unknown>(url: string): Promise<T> => {
        const res = await fetch(url, { method: "DELETE" })
        return res.json()
      },
    },
    navigate:
      options.navigate ??
      ((path: string) => {
        window.location.href = path
      }),
    refresh: () => {
      window.location.reload()
    },
    toast: (_message: string, _opts?: unknown) => {
      // In React mode, toasts are handled by the render layer
    },
    openModal: (_id: string) => {
      // In React mode, modals are controlled by state
    },
    closeModal: (_id: string) => {
      // In React mode, modals are controlled by state
    },
    emitSignal: (_signal) => {
      // In React mode, signals are handled by the withSignalHandler
    },
    pageId: page.id,
    componentId: undefined,
    componentMeta: undefined,
    row: undefined,
    value: undefined,
    signal: undefined,
    form: undefined,
  }

  return createElement(
    "div",
    {
      className: `dsl-page dsl-layout-${page.env.layout}`,
      "data-page-id": page.id,
      "data-env-id": page.env.id,
    },
    ...page.children.map((child) => renderComponent(child, ctx)),
  )
}

/**
 * Compile a single ComponentNode to React element.
 * Useful for embedding Declaro components in existing React pages.
 */
export function compileComponentToReact(node: ComponentNode, options: CompileToReactOptions = {}): ReactNode {
  const page: PageNode = {
    type: "page",
    id: "inline",
    title: options.title ?? "Declaro Component",
    env: {
      type: "env",
      id: "inline-env",
      layout: "default",
      slots: ["main"],
    },
    children: [node],
  }
  return compileToReact(page, options)
}
