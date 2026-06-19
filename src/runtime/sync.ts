// Server state sync (Phase 4).
// Creates a reactive state handle that syncs with a server API.
//
// Usage:
//   const store = createSyncedState({
//     source: "/api/todos",
//     sync: { method: "POST", debounce: 300 },
//   })

import { createState, type StateHandle } from "./state"

export interface SyncConfig {
  /** URL to fetch initial state and post updates to */
  source: string
  /** HTTP method for updates. Default: "POST" */
  method?: "POST" | "PUT" | "PATCH"
  /** Debounce interval in ms for batched updates. Default: 300 */
  debounce?: number
  /** Transform server response to state shape */
  transform?: (data: unknown) => Record<string, unknown>
  /** Custom headers */
  headers?: Record<string, string>
}

export interface SyncedStateHandle<T extends Record<string, unknown>> {
  /** The reactive proxy object */
  state: T
  /** Subscribe to state changes */
  subscribe(listener: () => void): () => void
  /** Manually trigger a sync from the server */
  refresh(): Promise<void>
  /** True while a fetch is in flight */
  loading: boolean
  /** Last error, if any */
  error: Error | null
}

/**
 * Create a reactive state handle synced with a server API.
 *
 * On creation, GETs the `source` URL to load initial state.
 * On state changes, debounces and POSTs/PUTs/PATCHes the full
 * state snapshot to the source URL.
 */
export function createSyncedState<T extends Record<string, unknown>>(
  config: SyncConfig,
): SyncedStateHandle<T> {
  const method = config.method ?? "POST"
  const debounceMs = config.debounce ?? 300
  const transform = config.transform ?? ((d: unknown) => d as Record<string, unknown>)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(config.headers ?? {}),
  }

  let data: T = {} as T
  let loading = true
  let error: Error | null = null
  let syncTimer: ReturnType<typeof setTimeout> | null = null

  const listeners = new Set<() => void>()

  function notifyListeners(): void {
    listeners.forEach((fn) => fn())
  }

  const stateHandle = createState<T>(data)

  function scheduleSync(): void {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      const snapshot = stateHandle.getSnapshot()
      fetch(config.source, {
        method,
        headers,
        body: JSON.stringify(snapshot),
      }).catch((err) => {
        error = err as Error
        notifyListeners()
      })
    }, debounceMs)
  }

  // Subscribe to state changes for auto-sync
  stateHandle.subscribe(() => {
    scheduleSync()
  })

  async function refresh(): Promise<void> {
    loading = true
    error = null
    notifyListeners()
    try {
      const res = await fetch(config.source, { headers })
      const json = await res.json()
      const newData = transform(json) as T
      stateHandle.set(newData)
    } catch (err) {
      error = err as Error
    } finally {
      loading = false
      notifyListeners()
    }
  }

  // Initial fetch (async, doesn't block construction)
  refresh()

  // Create a proxy that wraps stateHandle.state with sync-specific methods
  return {
    get state(): T {
      return stateHandle.state
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh,
    get loading(): boolean {
      return loading
    },
    get error(): Error | null {
      return error
    },
  }
}
