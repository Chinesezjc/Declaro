// React Bridge runtime — hydrates [data-react-island] elements
// with third-party React components via dynamic import + ReactDOM.

interface ReactIslandEl extends HTMLElement {
  __dsl_react_root?: { unmount: () => void }
}

/**
 * Hydrate all React Islands on the page.
 * Each React Island is a self-contained React app.
 */
export async function hydrateReactIslands(): Promise<void> {
  const islands = document.querySelectorAll<ReactIslandEl>("[data-react-island]")
  if (islands.length === 0) return

  // Load React + ReactDOM from CDN if not already on page
  const React = (window as unknown as Record<string, unknown>).React
  const ReactDOM = (window as unknown as Record<string, unknown>).ReactDOM

  if (!React || !ReactDOM) {
    console.warn("[Declaro React Bridge] React/ReactDOM not found. Load them via Script() in page head:")
    console.warn('  Script({ src: "https://unpkg.com/react@18/umd/react.production.min.js" })')
    console.warn('  Script({ src: "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" })')
    return
  }

  const ReactCreateElement = (React as Record<string, unknown>).createElement as
    (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown
  const ReactDOMCreateRoot = (ReactDOM as Record<string, unknown>).createRoot as
    (el: HTMLElement) => { render(el: unknown): void; unmount(): void }

  for (const el of Array.from(islands)) {
    const componentPath = el.getAttribute("data-react-component")
    const propsJson = el.getAttribute("data-react-props") || "{}"

    if (!componentPath) continue

    try {
      // Dynamic import the React component
      const mod = await import(/* @vite-ignore */ componentPath)
      const Component = (mod as Record<string, unknown>).default || mod
      const props = JSON.parse(propsJson)

      const root = ReactDOMCreateRoot(el)
      root.render(ReactCreateElement(Component as unknown as () => unknown, props))
      ;(el as ReactIslandEl).__dsl_react_root = root
    } catch (err) {
      console.error(`[Declaro React Bridge] Failed to hydrate "${componentPath}":`, err)
      el.innerHTML = `<span style="color:red">Failed to load: ${componentPath}</span>`
    }
  }
}

// Auto-hydrate on DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateReactIslands)
  } else {
    hydrateReactIslands()
  }
}
