"use strict";
var __DSL_RUNTIME__ = (() => {
  // src/runtime/state.ts
  function createState(initial) {
    const internals = {
      data: { ...initial },
      listeners: /* @__PURE__ */ new Set(),
      pending: false
    };
    const notify = () => {
      if (internals.pending) return;
      internals.pending = true;
      queueMicrotask(() => {
        internals.pending = false;
        internals.listeners.forEach((fn) => fn());
      });
    };
    const proxy = new Proxy(internals.data, {
      set(_target, prop, value) {
        const key = prop;
        if (internals.data[key] === value) return true;
        internals.data[key] = value;
        notify();
        return true;
      },
      deleteProperty(_target, prop) {
        const key = prop;
        if (!(key in internals.data)) return true;
        delete internals.data[key];
        notify();
        return true;
      },
      get(_target, prop) {
        const key = prop;
        return internals.data[key];
      }
    });
    return {
      state: proxy,
      subscribe(listener) {
        internals.listeners.add(listener);
        return () => {
          internals.listeners.delete(listener);
        };
      },
      set(partial) {
        let changed = false;
        for (const key of Object.keys(partial)) {
          if (internals.data[key] !== partial[key]) {
            internals.data[key] = partial[key];
            changed = true;
          }
        }
        if (changed) notify();
      },
      getSnapshot() {
        return { ...internals.data };
      }
    };
  }

  // src/runtime/dom.ts
  function patchElement(el, html) {
    el.innerHTML = html;
  }
  function bindIslandEvents(root, registry) {
    const oldHandler = root.__dsl_event_handler;
    if (oldHandler) {
      root.removeEventListener("click", oldHandler, true);
      root.removeEventListener("input", oldHandler, true);
      root.removeEventListener("change", oldHandler, true);
      root.removeEventListener("submit", oldHandler, true);
    }
    const handler = (e) => {
      const target = e.target;
      if (!target) return;
      const el = target.closest("[data-dsl-event]");
      if (!el || !root.contains(el)) return;
      const attr = el.getAttribute("data-dsl-event");
      const parts = attr.split(":");
      if (parts.length < 2) return;
      const eventName = parts[0];
      const handlerKey = parts.slice(1).join(":");
      if (e.type !== eventName) return;
      const fn = registry[handlerKey];
      if (fn) fn(e, el);
    };
    root.__dsl_event_handler = handler;
    root.addEventListener("click", handler, true);
    root.addEventListener("input", handler, true);
    root.addEventListener("change", handler, true);
    root.addEventListener("submit", handler, true);
  }
  function syncTextBindings(root, state) {
    root.querySelectorAll("[data-dsl-text]").forEach((el) => {
      const key = el.getAttribute("data-dsl-text");
      const val = state[key];
      el.textContent = val != null ? String(val) : "";
    });
  }
  function escapeHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // src/runtime/island.ts
  var islandRegistry = /* @__PURE__ */ new Map();
  function defineIsland(def) {
    islandRegistry.set(def.id, def);
  }
  function hydrateAll() {
    islandRegistry.forEach((def) => {
      const container = document.querySelector(`[data-island="${def.id}"]`);
      if (!container) return;
      const stateJson = container.getAttribute("data-dsl-initial-state");
      let initialState = def.initialState;
      if (stateJson) {
        try {
          initialState = JSON.parse(stateJson);
        } catch {
        }
      }
      const stateHandle = createState(initialState);
      const wrappedHandlers = {};
      for (const key of Object.keys(def.handlers)) {
        wrappedHandlers[key] = (event, _el) => {
          def.handlers[key](event, stateHandle, container);
        };
      }
      bindIslandEvents(container, wrappedHandlers);
      stateHandle.subscribe(() => {
        syncTextBindings(container, stateHandle.getSnapshot());
      });
      syncTextBindings(container, stateHandle.getSnapshot());
      container.setAttribute("data-dsl-hydrated", "true");
      container.__dsl_state = stateHandle;
    });
  }
  function getIslandState(id) {
    const container = document.querySelector(`[data-island="${id}"]`);
    if (!container) return null;
    return container.__dsl_state ?? null;
  }

  // src/runtime/legacy.ts
  function toggleCollapse(btn) {
    const section = btn.closest(".dsl-card") || btn.closest(".dsl-box");
    if (!section) return;
    const isCollapsed = section.getAttribute("data-collapsed") === "true";
    section.setAttribute("data-collapsed", String(!isCollapsed));
    btn.textContent = isCollapsed ? btn.getAttribute("data-collapse-label") || "\u6536\u8D77" : btn.getAttribute("data-expand-label") || "\u5C55\u5F00";
    btn.setAttribute("aria-expanded", String(isCollapsed));
    const bodies = section.querySelectorAll(".dsl-card-body, .dsl-card-footer, .dsl-box-children");
    bodies.forEach((el) => {
      ;
      el.style.display = isCollapsed ? "" : "none";
    });
  }
  function showToast(message, variant, duration) {
    const stack = document.querySelector(".toast-stack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = "toast toast-" + (variant || "info") + " toast-entering-fade-right";
    toast.textContent = message;
    toast.style.animationDuration = "180ms";
    stack.appendChild(toast);
    setTimeout(() => {
      toast.className = "toast toast-" + (variant || "info") + " toast-visible";
    }, 180);
    setTimeout(() => {
      toast.className = "toast toast-" + (variant || "info") + " toast-exiting-fade-right";
      toast.style.animationDuration = "240ms";
      setTimeout(() => toast.remove(), 240);
    }, (duration || 2600) + 180);
  }
  function handleFormSubmit(event, formId) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const values = {};
    data.forEach((v, k) => {
      values[k] = v;
    });
    fetch("/api/form/" + formId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    }).then((r) => r.json()).then((result) => {
      showToast(result.message || "\u5DF2\u63D0\u4EA4", result.ok ? "success" : "warning", 3e3);
    }).catch(() => {
      showToast("\u63D0\u4EA4\u5931\u8D25", "danger", 3e3);
    });
  }
  function loadTables() {
    document.querySelectorAll(".dsl-table[data-datasource]").forEach((table) => {
      const url = table.getAttribute("data-datasource");
      fetch(url).then((r) => r.json()).then((data) => {
        const rows = Array.isArray(data) ? data : data.data || data.items || data.rows || [];
        const tbody = table.querySelector("tbody");
        if (!tbody || rows.length === 0) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="dsl-table-empty">\u6682\u65E0\u6570\u636E</td></tr>';
          return;
        }
        const cols = table.querySelectorAll("th");
        const colKeys = [];
        cols.forEach((th) => {
          const sortBtn = th.querySelector(".dsl-sort-btn");
          colKeys.push(
            sortBtn ? sortBtn.getAttribute("onclick")?.match(/'([^']+)'/)?.[1] ?? null : null
          );
        });
        tbody.innerHTML = rows.map((row) => {
          return "<tr>" + colKeys.map((key) => {
            const val = key ? row[key] != null ? row[key] : "" : "";
            return "<td>" + (typeof val === "boolean" ? val ? "\u662F" : "\u5426" : String(val)) + "</td>";
          }).join("") + "</tr>";
        }).join("");
      }).catch(() => {
        const tbody = table.querySelector("tbody");
        if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="dsl-table-error">\u52A0\u8F7D\u5931\u8D25</td></tr>';
      });
    });
  }
  function initCollapsibleSections() {
    document.querySelectorAll('[data-collapsed="true"]').forEach((el) => {
      el.querySelectorAll(".dsl-card-body, .dsl-card-footer, .dsl-box-children").forEach((child) => {
        ;
        child.style.display = "none";
      });
    });
  }
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.removeAttribute("hidden");
    if (!document.querySelector(".dsl-modal-backdrop")) {
      const backdrop = document.createElement("div");
      backdrop.className = "dsl-modal-backdrop";
      backdrop.addEventListener("click", () => closeModal(id));
      document.body.appendChild(backdrop);
    }
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute("hidden", "");
    const backdrop = document.querySelector(".dsl-modal-backdrop");
    if (backdrop) backdrop.remove();
    document.body.style.overflow = "";
    const anyOpen = document.querySelector(".dsl-modal:not([hidden])");
    if (!anyOpen) {
      document.body.style.overflow = "";
    }
  }
  function initSliders() {
    document.querySelectorAll(".dsl-slider-field[data-dsl-slider]").forEach((field) => {
      const config = JSON.parse(field.getAttribute("data-dsl-slider"));
      const range = field.querySelector('input[type="range"]');
      const output = field.querySelector("output");
      const numInput = field.querySelector('input[type="number"]');
      if (!range) return;
      const syncOutput = () => {
        const val = range.value;
        if (output) output.textContent = val;
        if (numInput) numInput.value = val;
        if (config.onSignal) {
          const event = new CustomEvent("dsl:slider-change", {
            detail: { name: config.name, value: config.valueType === "int" ? parseInt(val, 10) : parseFloat(val) },
            bubbles: true
          });
          field.dispatchEvent(event);
        }
      };
      range.addEventListener("input", syncOutput);
      if (numInput) {
        numInput.addEventListener("change", () => {
          range.value = numInput.value;
          syncOutput();
        });
      }
      syncOutput();
    });
  }
  function emitSignal(signal) {
    const event = new CustomEvent("dsl:signal", { detail: signal, bubbles: true });
    document.dispatchEvent(event);
  }
  function initLegacy() {
    document.addEventListener("DOMContentLoaded", () => {
      loadTables();
      initCollapsibleSections();
      initSliders();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const visibleModals = document.querySelectorAll(".dsl-modal:not([hidden])");
        visibleModals.forEach((m) => closeModal(m.id));
      }
    });
  }
  function exposeGlobals() {
    const w = window;
    w.toggleCollapse = toggleCollapse;
    w.showToast = showToast;
    w.handleFormSubmit = handleFormSubmit;
    w.sortTable = (btn, key) => {
      const table = btn.closest("table");
      if (!table) return;
      const tbody = table.querySelector("tbody");
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const isAsc = btn.getAttribute("data-sort-dir") !== "asc";
      btn.setAttribute("data-sort-dir", isAsc ? "asc" : "desc");
      rows.sort((a, b) => {
        const aVal = a.querySelector("td")?.textContent ?? "";
        const bVal = b.querySelector("td")?.textContent ?? "";
        return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
      rows.forEach((r) => tbody.appendChild(r));
    };
  }

  // src/runtime/runtime.ts
  var DSL = {
    // State
    createState,
    // DOM
    patchElement,
    bindIslandEvents,
    syncTextBindings,
    escapeHTML,
    // Islands
    defineIsland,
    hydrateAll,
    getIslandState,
    // Legacy
    toggleCollapse,
    showToast,
    handleFormSubmit,
    loadTables,
    initCollapsibleSections,
    initSliders,
    openModal,
    closeModal,
    emitSignal,
    initLegacy,
    exposeGlobals
  };
  window.__DSL__ = DSL;
  exposeGlobals();
  initLegacy();
})();
