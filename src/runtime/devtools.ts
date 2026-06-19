// Declaro DevTools — lightweight debug panel injected in dev mode.
// Activated when URL contains ?__dsl_debug=1

export function initDevTools(): void {
  if (typeof window === "undefined") return
  if (!window.location.search.includes("__dsl_debug=1")) return

  // Wait for DOM + islands to hydrate
  const init = (): void => {
    const islands = document.querySelectorAll<HTMLElement>("[data-island]")
    if (islands.length === 0) {
      setTimeout(init, 500)
      return
    }

    // Create panel
    const panel = document.createElement("div")
    panel.id = "__dsl_devtools"
    panel.innerHTML = `
<style>
#__dsl_devtools { position:fixed; bottom:12px; right:12px; z-index:99999; width:360px; max-height:500px; background:#1e293b; color:#e2e8f0; border-radius:10px; box-shadow:0 8px 40px rgba(0,0,0,.4); font:12px/1.5 monospace; overflow:hidden; }
#__dsl_devtools .dt-header { padding:10px 14px; background:#0f172a; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; }
#__dsl_devtools .dt-header h3 { margin:0; font-size:13px; }
#__dsl_devtools .dt-body { padding:8px 0; max-height:420px; overflow-y:auto; }
#__dsl_devtools .dt-section { padding:6px 14px; border-bottom:1px solid #334155; }
#__dsl_devtools .dt-section-title { font-weight:700; color:#94a3b8; margin-bottom:4px; }
#__dsl_devtools .dt-island { padding:6px 10px; margin:2px 8px; background:#334155; border-radius:4px; }
#__dsl_devtools .dt-island-name { color:#38bdf8; font-weight:600; }
#__dsl_devtools .dt-island-state { color:#a5b4fc; margin:2px 0; white-space:pre-wrap; word-break:break-all; }
#__dsl_devtools .dt-island-meta { color:#64748b; font-size:10px; }
#__dsl_devtools .dt-empty { color:#64748b; padding:10px 14px; }
#__dsl_devtools .dt-close { color:#94a3b8; cursor:pointer; font-size:16px; line-height:1; }
#__dsl_devtools.collapsed .dt-body { display:none; }
</style>
<div class="dt-header" onclick="this.parentElement.classList.toggle('collapsed')">
  <h3>🏝️ Declaro DevTools</h3>
  <span class="dt-close" onclick="event.stopPropagation();document.getElementById('__dsl_devtools').remove()">×</span>
</div>
<div class="dt-body">
  <div class="dt-section">
    <div class="dt-section-title">Islands (<span id="dt-island-count">${islands.length}</span>)</div>
    <div id="dt-island-list"></div>
  </div>
  <div class="dt-section">
    <div class="dt-section-title">Signal Log</div>
    <div id="dt-signal-log" class="dt-empty">No signals yet</div>
  </div>
  <div class="dt-section">
    <div class="dt-section-title">Source Map</div>
    <div id="dt-source-list"></div>
  </div>
</div>`
    document.body.appendChild(panel)

    // Update island states
    const updateIslands = (): void => {
      const list = document.getElementById("dt-island-list")!
      let html = ""
      document.querySelectorAll<HTMLElement>("[data-island]").forEach((el) => {
        const id = el.getAttribute("data-island")!
        const hydrated = el.getAttribute("data-dsl-hydrated") === "true"
        const stateHandle = (el as unknown as Record<string, unknown>).__dsl_state as
          { getSnapshot: () => Record<string, unknown> } | undefined
        const snapshot = stateHandle ? stateHandle.getSnapshot() : null
        const source = el.getAttribute("data-dsl-source") || "—"
        html += `<div class="dt-island">
          <div class="dt-island-name">${escapeHTMLId(id)} ${hydrated ? '✅' : '⏳'}</div>
          <div class="dt-island-state">${snapshot ? JSON.stringify(snapshot, null, 1) : 'N/A'}</div>
          <div class="dt-island-meta">${escapeHTMLId(source)}</div>
        </div>`
      })
      list.innerHTML = html || '<div class="dt-empty">No islands found</div>'
    }

    // Listen for signals
    const signalLog: string[] = []
    document.addEventListener("dsl:signal", ((e: CustomEvent) => {
      signalLog.push(`${new Date().toLocaleTimeString()} — ${e.detail?.type || "unknown"}`)
      if (signalLog.length > 20) signalLog.shift()
      const logEl = document.getElementById("dt-signal-log")
      if (logEl) {
        logEl.innerHTML = signalLog.length
          ? signalLog.map((s) => `<div>${escapeHTMLId(s)}</div>`).join("")
          : '<div class="dt-empty">No signals yet</div>'
      }
    }) as EventListener)

    // Source map
    const sources = new Set<string>()
    document.querySelectorAll<HTMLElement>("[data-dsl-source]").forEach((el) => {
      sources.add(el.getAttribute("data-dsl-source")!)
    })
    const srcList = document.getElementById("dt-source-list")
    if (srcList) {
      srcList.innerHTML = sources.size
        ? Array.from(sources).map((s) => `<div>📍 ${escapeHTMLId(s)}</div>`).join("")
        : '<div class="dt-empty">No source mappings (production build?)</div>'
    }

    updateIslands()
    // Periodic refresh
    setInterval(updateIslands, 2000)
  }

  setTimeout(init, 100)
}

function escapeHTMLId(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Auto-init
initDevTools()
