// Advanced reactive state with deep tracking (Phase 4).
// Enhances the Phase 2 shallow proxy with recursive Proxy wrapping
// for nested objects and arrays.
//
// Usage: createState(initial, { deep: true })

import type { StateHandle } from "./state"

interface DeepStateOptions {
  /** Enable deep tracking for nested objects and arrays. Default: false */
  deep?: boolean
}

interface InternalStore<T extends Record<string, unknown>> {
  data: T
  listeners: Set<() => void>
  pending: boolean
  deep: boolean
}

function notify(store: InternalStore<Record<string, unknown>>): void {
  if (store.pending) return
  store.pending = true
  queueMicrotask(() => {
    store.pending = false
    store.listeners.forEach((fn) => fn())
  })
}

function deepProxy<T extends Record<string, unknown>>(
  data: T,
  store: InternalStore<T>,
): T {
  return new Proxy(data, {
    set(_target, prop, value) {
      const key = prop as keyof T
      const old = data[key]
      if (old === value) return true
      // If deep and the new value is an object/array, wrap it
      if (store.deep && value != null && typeof value === "object") {
        data[key] = deepProxy(value as Record<string, unknown>, store as InternalStore<Record<string, unknown>>) as T[keyof T]
      } else {
        data[key] = value
      }
      notify(store as InternalStore<Record<string, unknown>>)
      return true
    },
    deleteProperty(_target, prop) {
      const key = prop as keyof T
      if (!(key in data)) return true
      delete data[key]
      notify(store as InternalStore<Record<string, unknown>>)
      return true
    },
    get(_target, prop) {
      const key = prop as keyof T
      const val = data[key]
      // Lazy deep wrapping: if deep mode and value is object/array, wrap on access
      if (store.deep && val != null && typeof val === "object") {
        return deepProxy(val as Record<string, unknown>, store as InternalStore<Record<string, unknown>>)
      }
      return val
    },
  }) as T
}

/**
 * Create a reactive state handle with optional deep tracking.
 *
 * With deep: true, nested object and array mutations trigger subscribers:
 *   state.todos[0].done = true  // triggers
 *   state.user.profile.name = "Bob"  // triggers
 *   state.todos.push(newItem)  // triggers (array methods intercepted)
 */
export function createState<T extends Record<string, unknown>>(
  initial: T,
  options: DeepStateOptions = {},
): StateHandle<T> {
  const store: InternalStore<T> = {
    data: { ...initial } as T,
    listeners: new Set(),
    pending: false,
    deep: options.deep ?? false,
  }

  // If deep, wrap initial nested objects
  if (store.deep) {
    for (const key of Object.keys(store.data) as (keyof T)[]) {
      const val = store.data[key]
      if (val != null && typeof val === "object") {
        store.data[key] = deepProxy(
          val as Record<string, unknown>,
          store as InternalStore<Record<string, unknown>>,
        ) as T[keyof T]
      }
    }
  }

  const proxy = new Proxy(store.data, {
    set(target, prop, value) {
      const key = prop as keyof T
      const old = target[key]
      if (old === value) return true
      if (store.deep && value != null && typeof value === "object") {
        target[key] = deepProxy(
          value as Record<string, unknown>,
          store as InternalStore<Record<string, unknown>>,
        ) as T[keyof T]
      } else {
        target[key] = value
      }
      notify(store as InternalStore<Record<string, unknown>>)
      return true
    },
    deleteProperty(target, prop) {
      const key = prop as keyof T
      if (!(key in target)) return true
      delete target[key]
      notify(store as InternalStore<Record<string, unknown>>)
      return true
    },
    get(target, prop) {
      const key = prop as keyof T
      const val = target[key]
      if (store.deep && val != null && typeof val === "object") {
        return deepProxy(
          val as Record<string, unknown>,
          store as InternalStore<Record<string, unknown>>,
        )
      }
      return val
    },
  }) as T

  return {
    state: proxy,
    subscribe(listener: () => void): () => void {
      store.listeners.add(listener)
      return () => {
        store.listeners.delete(listener)
      }
    },
    set(partial: Partial<T>): void {
      let changed = false
      for (const key of Object.keys(partial) as (keyof T)[]) {
        if (store.data[key] !== partial[key]) {
          store.data[key] = partial[key] as T[keyof T]
          changed = true
        }
      }
      if (changed) notify(store as InternalStore<Record<string, unknown>>)
    },
    getSnapshot(): T {
      return JSON.parse(JSON.stringify(store.data))
    },
  }
}
