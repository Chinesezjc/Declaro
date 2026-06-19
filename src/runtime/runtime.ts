// Declaro client runtime entry point.
// Bundled by esbuild into a single IIFE and injected by the compiler.
// Exposes all runtime APIs under window.__DSL__.

import { createState } from "./state"
import { patchElement, bindIslandEvents, syncTextBindings, escapeHTML } from "./dom"
import { defineIsland, hydrateAll, getIslandState } from "./island"
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

const DSL = {
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
  exposeGlobals,
}

// Mount to window
;(window as unknown as Record<string, unknown>).__DSL__ = DSL

// Auto-init legacy features and expose globals
exposeGlobals()
initLegacy()
