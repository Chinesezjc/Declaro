// Legacy runtime functions extracted from compile.ts inline script.
// These maintain backward compatibility with existing compiled pages.

export function toggleCollapse(btn: HTMLElement): void {
  const section = btn.closest(".dsl-card") || btn.closest(".dsl-box")
  if (!section) return
  const isCollapsed = section.getAttribute("data-collapsed") === "true"
  section.setAttribute("data-collapsed", String(!isCollapsed))
  btn.textContent = isCollapsed
    ? (btn.getAttribute("data-collapse-label") || "收起")
    : (btn.getAttribute("data-expand-label") || "展开")
  btn.setAttribute("aria-expanded", String(isCollapsed))
  const bodies = section.querySelectorAll(".dsl-card-body, .dsl-card-footer, .dsl-box-children")
  bodies.forEach((el) => {
    ;(el as HTMLElement).style.display = isCollapsed ? "" : "none"
  })
}

export function showToast(message: string, variant: string, duration: number): void {
  const stack = document.querySelector(".toast-stack")
  if (!stack) return
  const toast = document.createElement("div")
  toast.className = "toast toast-" + (variant || "info") + " toast-entering-fade-right"
  toast.textContent = message
  toast.style.animationDuration = "180ms"
  stack.appendChild(toast)
  setTimeout(() => {
    toast.className = "toast toast-" + (variant || "info") + " toast-visible"
  }, 180)
  setTimeout(() => {
    toast.className = "toast toast-" + (variant || "info") + " toast-exiting-fade-right"
    toast.style.animationDuration = "240ms"
    setTimeout(() => toast.remove(), 240)
  }, (duration || 2600) + 180)
}

export interface FormValues {
  [key: string]: unknown
}

export function handleFormSubmit(event: Event, formId: string): void {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const data = new FormData(form)
  const values: FormValues = {}
  data.forEach((v, k) => {
    values[k] = v
  })
  fetch("/api/form/" + formId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  })
    .then((r) => r.json())
    .then((result: { message?: string; ok?: boolean }) => {
      showToast(result.message || "已提交", result.ok ? "success" : "warning", 3000)
    })
    .catch(() => {
      showToast("提交失败", "danger", 3000)
    })
}

export function loadTables(): void {
  document.querySelectorAll<HTMLElement>(".dsl-table[data-datasource]").forEach((table) => {
    const url = table.getAttribute("data-datasource")!
    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        const rows = Array.isArray(data)
          ? (data as Record<string, unknown>[])
          : ((data as Record<string, unknown>).data ||
              (data as Record<string, unknown>).items ||
              (data as Record<string, unknown>).rows ||
              []) as Record<string, unknown>[]
        const tbody = table.querySelector("tbody")
        if (!tbody || rows.length === 0) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="dsl-table-empty">暂无数据</td></tr>'
          return
        }
        const cols = table.querySelectorAll("th")
        const colKeys: (string | null)[] = []
        cols.forEach((th) => {
          const sortBtn = th.querySelector(".dsl-sort-btn")
          colKeys.push(
            sortBtn
              ? (sortBtn.getAttribute("onclick")?.match(/'([^']+)'/)?.[1] ?? null)
              : null,
          )
        })
        tbody.innerHTML = rows
          .map((row) => {
            return (
              "<tr>" +
              colKeys
                .map((key) => {
                  const val = key ? (row[key] != null ? row[key] : "") : ""
                  return (
                    "<td>" +
                    (typeof val === "boolean"
                      ? val
                        ? "是"
                        : "否"
                      : String(val)) +
                    "</td>"
                  )
                })
                .join("") +
              "</tr>"
            )
          })
          .join("")
      })
      .catch(() => {
        const tbody = table.querySelector("tbody")
        if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="dsl-table-error">加载失败</td></tr>'
      })
  })
}

export function initCollapsibleSections(): void {
  document.querySelectorAll<HTMLElement>('[data-collapsed="true"]').forEach((el) => {
    el.querySelectorAll(".dsl-card-body, .dsl-card-footer, .dsl-box-children").forEach((child) => {
      ;(child as HTMLElement).style.display = "none"
    })
  })
}

// ===== Modal =====

export function openModal(id: string): void {
  const modal = document.getElementById(id)
  if (!modal) return
  modal.removeAttribute("hidden")
  // Add backdrop if not present
  if (!document.querySelector(".dsl-modal-backdrop")) {
    const backdrop = document.createElement("div")
    backdrop.className = "dsl-modal-backdrop"
    backdrop.addEventListener("click", () => closeModal(id))
    document.body.appendChild(backdrop)
  }
  document.body.style.overflow = "hidden"
}

export function closeModal(id: string): void {
  const modal = document.getElementById(id)
  if (!modal) return
  modal.setAttribute("hidden", "")
  const backdrop = document.querySelector(".dsl-modal-backdrop")
  if (backdrop) backdrop.remove()
  document.body.style.overflow = ""
  // Close all visible modals' backdrops
  const anyOpen = document.querySelector(".dsl-modal:not([hidden])")
  if (!anyOpen) {
    document.body.style.overflow = ""
  }
}

// ===== Slider =====

export function initSliders(): void {
  document.querySelectorAll<HTMLElement>(".dsl-slider-field[data-dsl-slider]").forEach((field) => {
    const config = JSON.parse(field.getAttribute("data-dsl-slider")!)
    const range = field.querySelector<HTMLInputElement>('input[type="range"]')
    const output = field.querySelector("output")
    const numInput = field.querySelector<HTMLInputElement>('input[type="number"]')

    if (!range) return

    const syncOutput = () => {
      const val = range.value
      if (output) output.textContent = val
      if (numInput) numInput.value = val
      // Fire onSignal if configured
      if (config.onSignal) {
        const event = new CustomEvent("dsl:slider-change", {
          detail: { name: config.name, value: config.valueType === "int" ? parseInt(val, 10) : parseFloat(val) },
          bubbles: true,
        })
        field.dispatchEvent(event)
      }
    }

    range.addEventListener("input", syncOutput)
    if (numInput) {
      numInput.addEventListener("change", () => {
        range.value = numInput.value
        syncOutput()
      })
    }
    syncOutput()
  })
}

// ===== Signal system =====

export function emitSignal(signal: { type: string; sourceId?: string; value?: unknown; payload?: Record<string, unknown> }): void {
  const event = new CustomEvent("dsl:signal", { detail: signal, bubbles: true })
  document.dispatchEvent(event)
}

// ===== Init all =====

export function initLegacy(): void {
  document.addEventListener("DOMContentLoaded", () => {
    loadTables()
    initCollapsibleSections()
    initSliders()
  })

  // Global keyboard shortcut: Escape closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const visibleModals = document.querySelectorAll(".dsl-modal:not([hidden])")
      visibleModals.forEach((m) => closeModal(m.id))
    }
  })
}

// Expose global functions for onclick attributes
export function exposeGlobals(): void {
  const w = window as unknown as Record<string, unknown>
  w.toggleCollapse = toggleCollapse
  w.showToast = showToast
  w.handleFormSubmit = handleFormSubmit
  // Table sort function (called from onclick attr)
  w.sortTable = (btn: HTMLElement, key: string) => {
    const table = btn.closest("table")
    if (!table) return
    const tbody = table.querySelector("tbody")
    if (!tbody) return
    const rows = Array.from(tbody.querySelectorAll("tr"))
    const isAsc = btn.getAttribute("data-sort-dir") !== "asc"
    btn.setAttribute("data-sort-dir", isAsc ? "asc" : "desc")
    rows.sort((a, b) => {
      const aVal = a.querySelector("td")?.textContent ?? ""
      const bVal = b.querySelector("td")?.textContent ?? ""
      return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
    rows.forEach((r) => tbody.appendChild(r))
  }
}
