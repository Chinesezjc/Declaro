import { useEffect, useMemo, useRef, useState } from "react"
import { toSerializableIR, type ToastOptions } from "../dsl"
import { renderPage, type RuntimeContext } from "../renderer/react"
import {
  generatedChatMessages,
  initialApplications,
  initialChatMessages,
  initialStudents,
  type ApplicationRow,
  type ChatMessage,
  type StudentRow,
} from "./demoData"
import { dslRoutes, getDslRoute, getDslRouteByPath, type DslRoute, type PageKey } from "./routes"

type Toast = {
  id: string
  message: string
  phase: "entering" | "visible" | "exiting"
  options: Required<Pick<ToastOptions, "animation" | "duration" | "variant">> & Pick<ToastOptions, "className" | "key">
}

type DslDemoShellProps = {
  initialPageKey?: PageKey
  activePageKey?: PageKey
  mode?: "tabs" | "routes"
  showIr?: boolean
  onRouteChange?: (route: DslRoute) => void
}

const defaultToastOptions: Toast["options"] = {
  animation: "fade-right",
  duration: 2600,
  variant: "info",
}

const toastEnterMs = 180
const toastExitMs = 240

export function DslDemoShell({
  activePageKey,
  initialPageKey = "teacher",
  mode = "tabs",
  showIr = true,
  onRouteChange,
}: DslDemoShellProps) {
  const [selectedPageKey, setSelectedPageKey] = useState<PageKey>(initialPageKey)
  const [students, setStudents] = useState<StudentRow[]>(initialStudents)
  const [applications, setApplications] = useState<ApplicationRow[]>(initialApplications)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastTimers = useRef<Record<string, number>>({})
  const toastEnterTimers = useRef<Record<string, number>>({})
  const toastRemoveTimers = useRef<Record<string, number>>({})
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    return () => {
      clearTimerMap(toastTimers.current)
      clearTimerMap(toastEnterTimers.current)
      clearTimerMap(toastRemoveTimers.current)
    }
  }, [])

  const route = mode === "routes" ? getDslRoute(activePageKey ?? initialPageKey) : getDslRoute(selectedPageKey)
  const page = route.page

  const runtime = useMemo<RuntimeContext>(() => {
    return {
      user: route.user,
      request: {
        get: async <T = unknown>(url: string) => {
          await wait()

          if (url === "/api/students") {
            return students as T
          }

          if (url === "/api/applications") {
            return applications as T
          }

          if (url === "/api/chat/messages") {
            return chatMessages as T
          }

          if (url === "/api/groups/export") {
            return { ok: true } as T
          }

          throw new Error(`Unknown GET ${url}`)
        },
        post: async <T = unknown>(url: string, body?: unknown) => {
          await wait()

          if (url === "/api/applications") {
            const values = isRecord(body) ? body : {}
            const nextApplication: ApplicationRow = {
              id: `app-${Date.now()}`,
              studentName: String(values.name ?? "未命名学生"),
              groupName: "待分配",
              reason: String(values.reason ?? ""),
            }
            setApplications((currentApplications) => [nextApplication, ...currentApplications])
            return { ok: true } as T
          }

          if (url === "/api/applications/approve") {
            const applicationId = isRecord(body) ? body.applicationId : undefined
            const application = applications.find((currentApplication) => currentApplication.id === applicationId)

            if (application) {
              setStudents((currentStudents) => {
                if (currentStudents.some((student) => student.id === `stu-${application.id}`)) {
                  return currentStudents
                }

                return [
                  ...currentStudents,
                  {
                    id: `stu-${application.id}`,
                    name: application.studentName,
                    skills: "待填写",
                    groupName: application.groupName,
                    status: "已组队",
                  },
                ]
              })
            }

            setApplications((currentApplications) => currentApplications.filter((application) => application.id !== applicationId))
            return { ok: true } as T
          }

          if (url === "/api/applications/reject") {
            const applicationId = isRecord(body) ? body.applicationId : undefined
            setApplications((currentApplications) => currentApplications.filter((application) => application.id !== applicationId))
            return { ok: true } as T
          }

          if (url === "/api/chat/messages") {
            const nextMessage = generatedChatMessages[chatMessages.length % generatedChatMessages.length]
            setChatMessages((currentMessages) => [
              ...currentMessages,
              {
                ...nextMessage,
                id: `msg-${Date.now()}`,
              },
            ])
            return { ok: true } as T
          }

          throw new Error(`Unknown POST ${url}`)
        },
        put: async <T = unknown>() => {
          await wait()
          return { ok: true } as T
        },
        delete: async <T = unknown>() => {
          await wait()
          return { ok: true } as T
        },
      },
      toast: (message, options = {}) => {
        const toastOptions = {
          ...defaultToastOptions,
          ...options,
        }
        const id = toastOptions.key ?? `toast-${Date.now()}-${Math.random()}`

        if (toastTimers.current[id]) {
          window.clearTimeout(toastTimers.current[id])
        }
        if (toastEnterTimers.current[id]) {
          window.clearTimeout(toastEnterTimers.current[id])
          delete toastEnterTimers.current[id]
        }
        if (toastRemoveTimers.current[id]) {
          window.clearTimeout(toastRemoveTimers.current[id])
          delete toastRemoveTimers.current[id]
        }

        setToasts((currentToasts) => {
          const existingToast = currentToasts.find((toast) => toast.id === id)

          if (existingToast) {
            return currentToasts.map((toast) =>
              toast.id === id
                ? {
                    ...toast,
                    id,
                    message,
                    options: toastOptions,
                    phase: toast.phase === "exiting" ? "visible" : toast.phase,
                  }
                : toast,
            )
          }

          return [...currentToasts, { id, message, options: toastOptions, phase: "entering" }]
        })

        toastEnterTimers.current[id] = window.setTimeout(() => {
          setToasts((currentToasts) =>
            currentToasts.map((toast) => (toast.id === id && toast.phase === "entering" ? { ...toast, phase: "visible" } : toast)),
          )
          delete toastEnterTimers.current[id]
        }, toastEnterMs)

        toastTimers.current[id] = window.setTimeout(() => {
          delete toastTimers.current[id]
          setToasts((currentToasts) =>
            currentToasts.map((toast) => (toast.id === id ? { ...toast, phase: "exiting" } : toast)),
          )
          toastRemoveTimers.current[id] = window.setTimeout(() => {
            setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id))
            delete toastRemoveTimers.current[id]
          }, toastExitMs)
        }, toastOptions.duration)
      },
      refresh: () => {
        setRefreshKey((currentKey) => currentKey + 1)
      },
      navigate: (path) => {
        const nextRoute = getDslRouteByPath(path)
        if (nextRoute && onRouteChange) {
          onRouteChange(nextRoute)
          return
        }

        window.history.pushState({}, "", path)
      },
      openModal: (id) => {
        window.dispatchEvent(new CustomEvent("dsl:open-modal", { detail: { id } }))
      },
      closeModal: (id) => {
        window.dispatchEvent(new CustomEvent("dsl:close-modal", { detail: { id } }))
      },
    }
  }, [applications, chatMessages, students, route.user, refreshKey, onRouteChange])

  const ir = useMemo(() => JSON.stringify(toSerializableIR(page), null, 2), [page])

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div>
          <strong>TypeScript UI DSL</strong>
          <span>{route.user.name}</span>
        </div>
        <nav aria-label="示例页面">
          {dslRoutes.map((item) =>
            mode === "routes" ? (
              <a
                className={route.key === item.key ? "active" : ""}
                href={item.path}
                key={item.key}
                onClick={(event) => {
                  if (!onRouteChange) {
                    return
                  }

                  event.preventDefault()
                  onRouteChange(item)
                }}
              >
                {item.label}
              </a>
            ) : (
              <button
                className={selectedPageKey === item.key ? "active" : ""}
                key={item.key}
                type="button"
                onClick={() => setSelectedPageKey(item.key)}
              >
                {item.label}
              </button>
            ),
          )}
        </nav>
      </header>

      <main className={showIr ? "app-content" : "app-content app-content-without-ir"}>
        <section className="app-preview" key={page.id}>
          {renderPage(page, runtime)}
        </section>
        {showIr && (
          <aside className="app-ir">
            <h2>中间表示 IR</h2>
            <pre>{ir}</pre>
          </aside>
        )}
      </main>

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={[
              "toast",
              `toast-${toast.options.variant}`,
              `toast-${toast.phase}-${toast.options.animation}`,
              toast.options.className,
            ]
              .filter(Boolean)
              .join(" ")}
            key={toast.id}
            style={{
              animationDuration:
                toast.phase === "entering"
                  ? `${toastEnterMs}ms`
                  : toast.phase === "exiting"
                    ? `${toastExitMs}ms`
                    : undefined,
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function wait(ms = 220): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function clearTimerMap(timers: Record<string, number>): void {
  Object.values(timers).forEach((timer) => window.clearTimeout(timer))
  Object.keys(timers).forEach((key) => {
    delete timers[key]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
