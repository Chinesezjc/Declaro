// Reactive state system for Declaro islands.
// Phase 5: adds derive() + persist options.

export interface StateHandle<T extends Record<string, unknown>> {
  state: T
  subscribe(listener: () => void): () => void
  set(partial: Partial<T>): void
  getSnapshot(): T
  /** Create a derived (computed) state handle. Auto-updates when source changes. */
  derive<R extends Record<string, unknown>>(name: string, fn: (s: T) => R): StateHandle<R>
}

interface StateInternals<T extends Record<string, unknown>> {
  data: T
  listeners: Set<() => void>
  pending: boolean
  persistKey: string | null
}

export type StateOptions = {
  /** Persist state to localStorage or sessionStorage */
  persist?: "localStorage" | "sessionStorage"
}

export function createState<T extends Record<string, unknown>>(
  initial: T,
  options: StateOptions = {},
): StateHandle<T> {
  // Load persisted state if available
  const storage = options.persist === "localStorage" ? localStorage
    : options.persist === "sessionStorage" ? sessionStorage
    : null
  const persistKey = storage ? `__dsl_state_${window.location.pathname}` : null

  let initData = { ...initial } as T
  if (storage && persistKey) {
    try {
      const saved = storage.getItem(persistKey)
      if (saved) initData = { ...initData, ...JSON.parse(saved) }
    } catch { /* use default */ }
  }

  const internals: StateInternals<T> = {
    data: initData,
    listeners: new Set(),
    pending: false,
    persistKey,
  }

  const persist = (): void => {
    if (persistKey && storage) {
      try { storage.setItem(persistKey, JSON.stringify(internals.data)) } catch { /* quota exceeded */ }
    }
  }

  const notify = (): void => {
    if (internals.pending) return
    internals.pending = true
    queueMicrotask(() => {
      internals.pending = false
      internals.listeners.forEach((fn) => fn())
      persist()
    })
  }

  const proxy = new Proxy(internals.data, {
    set(_target, prop, value) {
      const key = prop as keyof T
      if (internals.data[key] === value) return true
      internals.data[key] = value
      notify()
      return true
    },
    deleteProperty(_target, prop) {
      const key = prop as keyof T
      if (!(key in internals.data)) return true
      delete internals.data[key]
      notify()
      return true
    },
    get(_target, prop) {
      return internals.data[prop as keyof T]
    },
  }) as T

  return {
    state: proxy,
    subscribe(listener: () => void): () => void {
      internals.listeners.add(listener)
      return () => {
        internals.listeners.delete(listener)
      }
    },
    set(partial: Partial<T>): void {
      let changed = false
      for (const key of Object.keys(partial) as (keyof T)[]) {
        if (internals.data[key] !== partial[key]) {
          internals.data[key] = partial[key] as T[keyof T]
          changed = true
        }
      }
      if (changed) notify()
    },
    getSnapshot(): T {
      return { ...internals.data }
    },
    derive<R extends Record<string, unknown>>(_name: string, fn: (s: T) => R): StateHandle<R> {
      const derived = createState(fn(internals.data))
      this.subscribe(() => {
        const newVal = fn(internals.data)
        derived.set(newVal)
      })
      return derived
    },
  }
}
