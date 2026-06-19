// Declaro client runtime entry point.
// Bundled by esbuild into a single IIFE and injected by the compiler.

import { createState } from "./state"
import { patchElement, bindIslandEvents, syncBindings, syncTextBindings, escapeHTML } from "./dom"
import { defineIsland, hydrateAll, getIslandState, setPageState } from "./island"
import {
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
  exposeGlobals,
} from "./legacy"
// Phase 5: React Bridge + DevTools
import "./react-bridge"
import "./devtools"

const DSL = {
  // State (Phase 5: derive + persist)
  createState,

  // DOM (Phase 5: syncBindings + morphdom patchElement)
  patchElement,
  bindIslandEvents,
  syncBindings,
  syncTextBindings,
  escapeHTML,

  // Islands (Phase 5: rerender + pageState)
  defineIsland,
  hydrateAll,
  getIslandState,
  setPageState,

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
  exposeGlobals,
}

// Mount to window
;(window as unknown as Record<string, unknown>).__DSL__ = DSL

// Auto-init legacy features and expose globals
exposeGlobals()
initLegacy()
