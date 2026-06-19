// Reactive state system for Declaro islands.
// Uses ES6 Proxy for shallow reactivity.

export interface StateHandle<T extends Record<string, unknown>> {
  /** The reactive proxy object. Reading returns current value,
   *  writing notifies all subscribers synchronously. */
  state: T
  /** Register a listener. Returns unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Batch-update multiple properties, one notification. */
  set(partial: Partial<T>): void
  /** Current state snapshot (non-reactive plain object). */
  getSnapshot(): T
}

interface StateInternals<T extends Record<string, unknown>> {
  data: T
  listeners: Set<() => void>
  pending: boolean
}

export function createState<T extends Record<string, unknown>>(initial: T): StateHandle<T> {
  const internals: StateInternals<T> = {
    data: { ...initial } as T,
    listeners: new Set(),
    pending: false,
  }

  const notify = (): void => {
    if (internals.pending) return
    internals.pending = true
    queueMicrotask(() => {
      internals.pending = false
      internals.listeners.forEach((fn) => fn())
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
      const key = prop as keyof T
      return internals.data[key]
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
  }
}
