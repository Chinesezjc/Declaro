"use strict";
var __DSL_RUNTIME__ = (() => {
  // src/runtime/state.ts
  function createState(initial, options = {}) {
    const storage = options.persist === "localStorage" ? localStorage : options.persist === "sessionStorage" ? sessionStorage : null;
    const persistKey = storage ? `__dsl_state_${window.location.pathname}` : null;
    let initData = { ...initial };
    if (storage && persistKey) {
      try {
        const saved = storage.getItem(persistKey);
        if (saved) initData = { ...initData, ...JSON.parse(saved) };
      } catch {
      }
    }
    const internals = {
      data: initData,
      listeners: /* @__PURE__ */ new Set(),
      pending: false,
      persistKey
    };
    const persist = () => {
      if (persistKey && storage) {
        try {
          storage.setItem(persistKey, JSON.stringify(internals.data));
        } catch {
        }
      }
    };
    const notify = () => {
      if (internals.pending) return;
      internals.pending = true;
      queueMicrotask(() => {
        internals.pending = false;
        internals.listeners.forEach((fn) => fn());
        persist();
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
        return internals.data[prop];
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
      },
      derive(_name, fn) {
        const derived = createState(fn(internals.data));
        this.subscribe(() => {
          const newVal = fn(internals.data);
          derived.set(newVal);
        });
        return derived;
      }
    };
  }

  // node_modules/morphdom/dist/morphdom-esm.js
  var DOCUMENT_FRAGMENT_NODE = 11;
  function morphAttrs(fromNode, toNode) {
    var toNodeAttrs = toNode.attributes;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;
    if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      return;
    }
    for (var i = toNodeAttrs.length - 1; i >= 0; i--) {
      attr = toNodeAttrs[i];
      attrName = attr.name;
      attrNamespaceURI = attr.namespaceURI;
      attrValue = attr.value;
      if (attrNamespaceURI) {
        attrName = attr.localName || attrName;
        fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);
        if (fromValue !== attrValue) {
          if (attr.prefix === "xmlns") {
            attrName = attr.name;
          }
          fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
        }
      } else {
        fromValue = fromNode.getAttribute(attrName);
        if (fromValue !== attrValue) {
          fromNode.setAttribute(attrName, attrValue);
        }
      }
    }
    var fromNodeAttrs = fromNode.attributes;
    for (var d = fromNodeAttrs.length - 1; d >= 0; d--) {
      attr = fromNodeAttrs[d];
      attrName = attr.name;
      attrNamespaceURI = attr.namespaceURI;
      if (attrNamespaceURI) {
        attrName = attr.localName || attrName;
        if (!toNode.hasAttributeNS(attrNamespaceURI, attrName)) {
          fromNode.removeAttributeNS(attrNamespaceURI, attrName);
        }
      } else {
        if (!toNode.hasAttribute(attrName)) {
          fromNode.removeAttribute(attrName);
        }
      }
    }
  }
  var range;
  var NS_XHTML = "http://www.w3.org/1999/xhtml";
  var doc = typeof document === "undefined" ? void 0 : document;
  var HAS_TEMPLATE_SUPPORT = !!doc && "content" in doc.createElement("template");
  var HAS_RANGE_SUPPORT = !!doc && doc.createRange && "createContextualFragment" in doc.createRange();
  function createFragmentFromTemplate(str) {
    var template = doc.createElement("template");
    template.innerHTML = str;
    return template.content.childNodes[0];
  }
  function createFragmentFromRange(str) {
    if (!range) {
      range = doc.createRange();
      range.selectNode(doc.body);
    }
    var fragment = range.createContextualFragment(str);
    return fragment.childNodes[0];
  }
  function createFragmentFromWrap(str) {
    var fragment = doc.createElement("body");
    fragment.innerHTML = str;
    return fragment.childNodes[0];
  }
  function toElement(str) {
    str = str.trim();
    if (HAS_TEMPLATE_SUPPORT) {
      return createFragmentFromTemplate(str);
    } else if (HAS_RANGE_SUPPORT) {
      return createFragmentFromRange(str);
    }
    return createFragmentFromWrap(str);
  }
  function compareNodeNames(fromEl, toEl) {
    var fromNodeName = fromEl.nodeName;
    var toNodeName = toEl.nodeName;
    var fromCodeStart, toCodeStart;
    if (fromNodeName === toNodeName) {
      return true;
    }
    fromCodeStart = fromNodeName.charCodeAt(0);
    toCodeStart = toNodeName.charCodeAt(0);
    if (fromCodeStart <= 90 && toCodeStart >= 97) {
      return fromNodeName === toNodeName.toUpperCase();
    } else if (toCodeStart <= 90 && fromCodeStart >= 97) {
      return toNodeName === fromNodeName.toUpperCase();
    } else {
      return false;
    }
  }
  function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML ? doc.createElement(name) : doc.createElementNS(namespaceURI, name);
  }
  function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
      var nextChild = curChild.nextSibling;
      toEl.appendChild(curChild);
      curChild = nextChild;
    }
    return toEl;
  }
  function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
      fromEl[name] = toEl[name];
      if (fromEl[name]) {
        fromEl.setAttribute(name, "");
      } else {
        fromEl.removeAttribute(name);
      }
    }
  }
  var specialElHandlers = {
    OPTION: function(fromEl, toEl) {
      var parentNode = fromEl.parentNode;
      if (parentNode) {
        var parentName = parentNode.nodeName.toUpperCase();
        if (parentName === "OPTGROUP") {
          parentNode = parentNode.parentNode;
          parentName = parentNode && parentNode.nodeName.toUpperCase();
        }
        if (parentName === "SELECT" && !parentNode.hasAttribute("multiple")) {
          if (fromEl.hasAttribute("selected") && !toEl.selected) {
            fromEl.setAttribute("selected", "selected");
            fromEl.removeAttribute("selected");
          }
          parentNode.selectedIndex = -1;
        }
      }
      syncBooleanAttrProp(fromEl, toEl, "selected");
    },
    /**
     * The "value" attribute is special for the <input> element since it sets
     * the initial value. Changing the "value" attribute without changing the
     * "value" property will have no effect since it is only used to the set the
     * initial value.  Similar for the "checked" attribute, and "disabled".
     */
    INPUT: function(fromEl, toEl) {
      syncBooleanAttrProp(fromEl, toEl, "checked");
      syncBooleanAttrProp(fromEl, toEl, "disabled");
      if (fromEl.value !== toEl.value) {
        fromEl.value = toEl.value;
      }
      if (!toEl.hasAttribute("value")) {
        fromEl.removeAttribute("value");
      }
    },
    TEXTAREA: function(fromEl, toEl) {
      var newValue = toEl.value;
      if (fromEl.value !== newValue) {
        fromEl.value = newValue;
      }
      var firstChild = fromEl.firstChild;
      if (firstChild) {
        var oldValue = firstChild.nodeValue;
        if (oldValue == newValue || !newValue && oldValue == fromEl.placeholder) {
          return;
        }
        firstChild.nodeValue = newValue;
      }
    },
    SELECT: function(fromEl, toEl) {
      if (!toEl.hasAttribute("multiple")) {
        var selectedIndex = -1;
        var i = 0;
        var curChild = fromEl.firstChild;
        var optgroup;
        var nodeName;
        while (curChild) {
          nodeName = curChild.nodeName && curChild.nodeName.toUpperCase();
          if (nodeName === "OPTGROUP") {
            optgroup = curChild;
            curChild = optgroup.firstChild;
            if (!curChild) {
              curChild = optgroup.nextSibling;
              optgroup = null;
            }
          } else {
            if (nodeName === "OPTION") {
              if (curChild.hasAttribute("selected")) {
                selectedIndex = i;
                break;
              }
              i++;
            }
            curChild = curChild.nextSibling;
            if (!curChild && optgroup) {
              curChild = optgroup.nextSibling;
              optgroup = null;
            }
          }
        }
        fromEl.selectedIndex = selectedIndex;
      }
    }
  };
  var ELEMENT_NODE = 1;
  var DOCUMENT_FRAGMENT_NODE$1 = 11;
  var TEXT_NODE = 3;
  var COMMENT_NODE = 8;
  function noop() {
  }
  function defaultGetNodeKey(node) {
    if (node) {
      return node.getAttribute && node.getAttribute("id") || node.id;
    }
  }
  function morphdomFactory(morphAttrs2) {
    return function morphdom2(fromNode, toNode, options) {
      if (!options) {
        options = {};
      }
      if (typeof toNode === "string") {
        if (fromNode.nodeName === "#document" || fromNode.nodeName === "HTML") {
          var toNodeHtml = toNode;
          toNode = doc.createElement("html");
          toNode.innerHTML = toNodeHtml;
        } else if (fromNode.nodeName === "BODY") {
          var toNodeBody = toNode;
          toNode = doc.createElement("html");
          toNode.innerHTML = toNodeBody;
          var bodyElement = toNode.querySelector("body");
          if (bodyElement) {
            toNode = bodyElement;
          }
        } else {
          toNode = toElement(toNode);
        }
      } else if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
        toNode = toNode.firstElementChild;
      }
      var getNodeKey = options.getNodeKey || defaultGetNodeKey;
      var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
      var onNodeAdded = options.onNodeAdded || noop;
      var onBeforeElUpdated = options.onBeforeElUpdated || noop;
      var onElUpdated = options.onElUpdated || noop;
      var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
      var onNodeDiscarded = options.onNodeDiscarded || noop;
      var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop;
      var skipFromChildren = options.skipFromChildren || noop;
      var addChild = options.addChild || function(parent, child) {
        return parent.appendChild(child);
      };
      var childrenOnly = options.childrenOnly === true;
      var fromNodesLookup = /* @__PURE__ */ Object.create(null);
      var keyedRemovalList = [];
      function addKeyedRemoval(key) {
        keyedRemovalList.push(key);
      }
      function walkDiscardedChildNodes(node, skipKeyedNodes) {
        if (node.nodeType === ELEMENT_NODE) {
          var curChild = node.firstChild;
          while (curChild) {
            var key = void 0;
            if (skipKeyedNodes && (key = getNodeKey(curChild))) {
              addKeyedRemoval(key);
            } else {
              onNodeDiscarded(curChild);
              if (curChild.firstChild) {
                walkDiscardedChildNodes(curChild, skipKeyedNodes);
              }
            }
            curChild = curChild.nextSibling;
          }
        }
      }
      function removeNode(node, parentNode, skipKeyedNodes) {
        if (onBeforeNodeDiscarded(node) === false) {
          return;
        }
        if (parentNode) {
          parentNode.removeChild(node);
        }
        onNodeDiscarded(node);
        walkDiscardedChildNodes(node, skipKeyedNodes);
      }
      function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
          var curChild = node.firstChild;
          while (curChild) {
            var key = getNodeKey(curChild);
            if (key) {
              fromNodesLookup[key] = curChild;
            }
            indexTree(curChild);
            curChild = curChild.nextSibling;
          }
        }
      }
      indexTree(fromNode);
      function handleNodeAdded(el) {
        onNodeAdded(el);
        var curChild = el.firstChild;
        while (curChild) {
          var nextSibling = curChild.nextSibling;
          var key = getNodeKey(curChild);
          if (key) {
            var unmatchedFromEl = fromNodesLookup[key];
            if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
              curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
              morphEl(unmatchedFromEl, curChild);
            } else {
              handleNodeAdded(curChild);
            }
          } else {
            handleNodeAdded(curChild);
          }
          curChild = nextSibling;
        }
      }
      function cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey) {
        while (curFromNodeChild) {
          var fromNextSibling = curFromNodeChild.nextSibling;
          if (curFromNodeKey = getNodeKey(curFromNodeChild)) {
            addKeyedRemoval(curFromNodeKey);
          } else {
            removeNode(
              curFromNodeChild,
              fromEl,
              true
              /* skip keyed nodes */
            );
          }
          curFromNodeChild = fromNextSibling;
        }
      }
      function morphEl(fromEl, toEl, childrenOnly2) {
        var toElKey = getNodeKey(toEl);
        if (toElKey) {
          delete fromNodesLookup[toElKey];
        }
        if (!childrenOnly2) {
          var beforeUpdateResult = onBeforeElUpdated(fromEl, toEl);
          if (beforeUpdateResult === false) {
            return;
          } else if (beforeUpdateResult instanceof HTMLElement) {
            fromEl = beforeUpdateResult;
            indexTree(fromEl);
          }
          morphAttrs2(fromEl, toEl);
          onElUpdated(fromEl);
          if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
            return;
          }
        }
        if (fromEl.nodeName !== "TEXTAREA") {
          morphChildren(fromEl, toEl);
        } else {
          specialElHandlers.TEXTAREA(fromEl, toEl);
        }
      }
      function morphChildren(fromEl, toEl) {
        var skipFrom = skipFromChildren(fromEl, toEl);
        var curToNodeChild = toEl.firstChild;
        var curFromNodeChild = fromEl.firstChild;
        var curToNodeKey;
        var curFromNodeKey;
        var fromNextSibling;
        var toNextSibling;
        var matchingFromEl;
        outer: while (curToNodeChild) {
          toNextSibling = curToNodeChild.nextSibling;
          curToNodeKey = getNodeKey(curToNodeChild);
          while (!skipFrom && curFromNodeChild) {
            fromNextSibling = curFromNodeChild.nextSibling;
            if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
              curToNodeChild = toNextSibling;
              curFromNodeChild = fromNextSibling;
              continue outer;
            }
            curFromNodeKey = getNodeKey(curFromNodeChild);
            var curFromNodeType = curFromNodeChild.nodeType;
            var isCompatible = void 0;
            if (curFromNodeType === curToNodeChild.nodeType) {
              if (curFromNodeType === ELEMENT_NODE) {
                if (curToNodeKey) {
                  if (curToNodeKey !== curFromNodeKey) {
                    if (matchingFromEl = fromNodesLookup[curToNodeKey]) {
                      if (fromNextSibling === matchingFromEl) {
                        isCompatible = false;
                      } else {
                        fromEl.insertBefore(matchingFromEl, curFromNodeChild);
                        if (curFromNodeKey) {
                          addKeyedRemoval(curFromNodeKey);
                        } else {
                          removeNode(
                            curFromNodeChild,
                            fromEl,
                            true
                            /* skip keyed nodes */
                          );
                        }
                        curFromNodeChild = matchingFromEl;
                        curFromNodeKey = getNodeKey(curFromNodeChild);
                      }
                    } else {
                      isCompatible = false;
                    }
                  }
                } else if (curFromNodeKey) {
                  isCompatible = false;
                }
                isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
                if (isCompatible) {
                  morphEl(curFromNodeChild, curToNodeChild);
                }
              } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                isCompatible = true;
                if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                  curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                }
              }
            }
            if (isCompatible) {
              curToNodeChild = toNextSibling;
              curFromNodeChild = fromNextSibling;
              continue outer;
            }
            if (curFromNodeKey) {
              addKeyedRemoval(curFromNodeKey);
            } else {
              removeNode(
                curFromNodeChild,
                fromEl,
                true
                /* skip keyed nodes */
              );
            }
            curFromNodeChild = fromNextSibling;
          }
          if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
            if (!skipFrom) {
              addChild(fromEl, matchingFromEl);
            }
            morphEl(matchingFromEl, curToNodeChild);
          } else {
            var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
            if (onBeforeNodeAddedResult !== false) {
              if (onBeforeNodeAddedResult) {
                curToNodeChild = onBeforeNodeAddedResult;
              }
              if (curToNodeChild.actualize) {
                curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
              }
              addChild(fromEl, curToNodeChild);
              handleNodeAdded(curToNodeChild);
            }
          }
          curToNodeChild = toNextSibling;
          curFromNodeChild = fromNextSibling;
        }
        cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey);
        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
          specialElHandler(fromEl, toEl);
        }
      }
      var morphedNode = fromNode;
      var morphedNodeType = morphedNode.nodeType;
      var toNodeType = toNode.nodeType;
      if (!childrenOnly) {
        if (morphedNodeType === ELEMENT_NODE) {
          if (toNodeType === ELEMENT_NODE) {
            if (!compareNodeNames(fromNode, toNode)) {
              onNodeDiscarded(fromNode);
              morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
            }
          } else {
            morphedNode = toNode;
          }
        } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) {
          if (toNodeType === morphedNodeType) {
            if (morphedNode.nodeValue !== toNode.nodeValue) {
              morphedNode.nodeValue = toNode.nodeValue;
            }
            return morphedNode;
          } else {
            morphedNode = toNode;
          }
        }
      }
      if (morphedNode === toNode) {
        onNodeDiscarded(fromNode);
      } else {
        if (toNode.isSameNode && toNode.isSameNode(morphedNode)) {
          return;
        }
        morphEl(morphedNode, toNode, childrenOnly);
        if (keyedRemovalList) {
          for (var i = 0, len = keyedRemovalList.length; i < len; i++) {
            var elToRemove = fromNodesLookup[keyedRemovalList[i]];
            if (elToRemove) {
              removeNode(elToRemove, elToRemove.parentNode, false);
            }
          }
        }
      }
      if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        if (morphedNode.actualize) {
          morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
        }
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
      }
      return morphedNode;
    };
  }
  var morphdom = morphdomFactory(morphAttrs);
  var morphdom_esm_default = morphdom;

  // src/runtime/dom.ts
  function patchElement(el, html) {
    morphdom_esm_default(el, html, {
      onBeforeElUpdated: (fromEl, toEl) => {
        if (fromEl.hasAttribute("data-dsl-event") && toEl.hasAttribute("data-dsl-event")) {
          return true;
        }
        return true;
      },
      childrenOnly: false
    });
  }
  function bindIslandEvents(root, registry) {
    const rootRecord = root;
    const oldHandler = rootRecord.__dsl_event_handler;
    if (oldHandler) {
      root.removeEventListener("click", oldHandler, true);
      root.removeEventListener("input", oldHandler, true);
      root.removeEventListener("change", oldHandler, true);
      root.removeEventListener("submit", oldHandler, true);
      root.removeEventListener("keydown", oldHandler, true);
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
    rootRecord.__dsl_event_handler = handler;
    root.addEventListener("click", handler, true);
    root.addEventListener("input", handler, true);
    root.addEventListener("change", handler, true);
    root.addEventListener("submit", handler, true);
    root.addEventListener("keydown", handler, true);
  }
  function syncBindings(root, state) {
    root.querySelectorAll("[data-dsl-text]").forEach((el) => {
      const key = el.getAttribute("data-dsl-text");
      const val = state[key];
      el.textContent = val != null ? String(val) : "";
    });
    root.querySelectorAll("[data-dsl-show]").forEach((el) => {
      const key = el.getAttribute("data-dsl-show");
      el.style.display = state[key] ? "" : "none";
    });
    root.querySelectorAll("[data-dsl-class]").forEach((el) => {
      const attr = el.getAttribute("data-dsl-class");
      const colonIdx = attr.indexOf(":");
      if (colonIdx < 0) return;
      const cls = attr.slice(0, colonIdx);
      const key = attr.slice(colonIdx + 1);
      el.classList.toggle(cls, !!state[key]);
    });
    root.querySelectorAll("[data-dsl-attr]").forEach((el) => {
      const attr = el.getAttribute("data-dsl-attr");
      const colonIdx = attr.indexOf(":");
      if (colonIdx < 0) return;
      const attrName = attr.slice(0, colonIdx);
      const rest = attr.slice(colonIdx + 1);
      const eqIdx = rest.indexOf("=");
      if (eqIdx >= 0) {
        const key = rest.slice(0, eqIdx);
        const targetVal = rest.slice(eqIdx + 1);
        if (String(state[key]) === targetVal) {
          el.setAttribute(attrName, "");
        } else {
          el.removeAttribute(attrName);
        }
      } else {
        const key = rest;
        if (state[key]) {
          el.setAttribute(attrName, "");
        } else {
          el.removeAttribute(attrName);
        }
      }
    });
    root.querySelectorAll("[data-dsl-list]").forEach((container) => {
      const key = container.getAttribute("data-dsl-list");
      const items = state[key];
      if (!Array.isArray(items)) return;
      const template = container.querySelector("template[data-dsl-list-item]");
      if (!template) return;
      const existingItems = container.querySelectorAll("[data-dsl-list-item]");
      existingItems.forEach((el) => el.remove());
      items.forEach((item, index) => {
        const clone = template.content.cloneNode(true);
        const wrapper = document.createElement("div");
        wrapper.setAttribute("data-dsl-list-item", "");
        wrapper.setAttribute("data-dsl-list-index", String(index));
        wrapper.appendChild(clone);
        const html = wrapper.innerHTML.replace(/\{\{(\w+)\}\}/g, (_m, prop) => {
          if (typeof item === "object" && item != null) {
            return String(item[prop] ?? "");
          }
          return prop === "_value" ? String(item) : "";
        });
        wrapper.innerHTML = html;
        container.appendChild(wrapper);
      });
    });
    root.querySelectorAll("[data-dsl-html]").forEach((el) => {
      const key = el.getAttribute("data-dsl-html");
      const val = state[key];
      el.innerHTML = val != null ? String(val) : "";
    });
  }
  function syncTextBindings(root, state) {
    syncBindings(root, state);
  }
  function escapeHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // src/runtime/island.ts
  var islandRegistry = /* @__PURE__ */ new Map();
  var pageStateHandle = null;
  function setPageState(handle) {
    pageStateHandle = handle;
  }
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
          def.handlers[key](event, stateHandle, container, pageStateHandle ?? void 0);
        };
      }
      bindIslandEvents(container, wrappedHandlers);
      if (def.strategy === "rerender" && def.renderFn) {
        stateHandle.subscribe(() => {
          const newHTML = def.renderFn(stateHandle.getSnapshot());
          patchElement(container, newHTML);
          bindIslandEvents(container, wrappedHandlers);
        });
        const initialHTML = def.renderFn(stateHandle.getSnapshot());
        patchElement(container, initialHTML);
        bindIslandEvents(container, wrappedHandlers);
      } else {
        stateHandle.subscribe(() => {
          syncBindings(container, stateHandle.getSnapshot());
        });
        syncBindings(container, stateHandle.getSnapshot());
      }
      if (def.usePageState && pageStateHandle) {
        pageStateHandle.subscribe(() => {
          syncBindings(container, stateHandle.getSnapshot());
        });
      }
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
      const range2 = field.querySelector('input[type="range"]');
      const output = field.querySelector("output");
      const numInput = field.querySelector('input[type="number"]');
      if (!range2) return;
      const syncOutput = () => {
        const val = range2.value;
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
      range2.addEventListener("input", syncOutput);
      if (numInput) {
        numInput.addEventListener("change", () => {
          range2.value = numInput.value;
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

  // src/runtime/react-bridge.ts
  async function hydrateReactIslands() {
    const islands = document.querySelectorAll("[data-react-island]");
    if (islands.length === 0) return;
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    if (!React || !ReactDOM) {
      console.warn("[Declaro React Bridge] React/ReactDOM not found. Load them via Script() in page head:");
      console.warn('  Script({ src: "https://unpkg.com/react@18/umd/react.production.min.js" })');
      console.warn('  Script({ src: "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" })');
      return;
    }
    const ReactCreateElement = React.createElement;
    const ReactDOMCreateRoot = ReactDOM.createRoot;
    for (const el of Array.from(islands)) {
      const componentPath = el.getAttribute("data-react-component");
      const propsJson = el.getAttribute("data-react-props") || "{}";
      if (!componentPath) continue;
      try {
        const mod = await import(
          /* @vite-ignore */
          componentPath
        );
        const Component = mod.default || mod;
        const props = JSON.parse(propsJson);
        const root = ReactDOMCreateRoot(el);
        root.render(ReactCreateElement(Component, props));
        el.__dsl_react_root = root;
      } catch (err) {
        console.error(`[Declaro React Bridge] Failed to hydrate "${componentPath}":`, err);
        el.innerHTML = `<span style="color:red">Failed to load: ${componentPath}</span>`;
      }
    }
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", hydrateReactIslands);
    } else {
      hydrateReactIslands();
    }
  }

  // src/runtime/devtools.ts
  function initDevTools() {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("__dsl_debug=1")) return;
    const init = () => {
      const islands = document.querySelectorAll("[data-island]");
      if (islands.length === 0) {
        setTimeout(init, 500);
        return;
      }
      const panel = document.createElement("div");
      panel.id = "__dsl_devtools";
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
  <h3>\u{1F3DD}\uFE0F Declaro DevTools</h3>
  <span class="dt-close" onclick="event.stopPropagation();document.getElementById('__dsl_devtools').remove()">\xD7</span>
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
</div>`;
      document.body.appendChild(panel);
      const updateIslands = () => {
        const list = document.getElementById("dt-island-list");
        let html = "";
        document.querySelectorAll("[data-island]").forEach((el) => {
          const id = el.getAttribute("data-island");
          const hydrated = el.getAttribute("data-dsl-hydrated") === "true";
          const stateHandle = el.__dsl_state;
          const snapshot = stateHandle ? stateHandle.getSnapshot() : null;
          const source = el.getAttribute("data-dsl-source") || "\u2014";
          html += `<div class="dt-island">
          <div class="dt-island-name">${escapeHTMLId(id)} ${hydrated ? "\u2705" : "\u23F3"}</div>
          <div class="dt-island-state">${snapshot ? JSON.stringify(snapshot, null, 1) : "N/A"}</div>
          <div class="dt-island-meta">${escapeHTMLId(source)}</div>
        </div>`;
        });
        list.innerHTML = html || '<div class="dt-empty">No islands found</div>';
      };
      const signalLog = [];
      document.addEventListener("dsl:signal", ((e) => {
        signalLog.push(`${(/* @__PURE__ */ new Date()).toLocaleTimeString()} \u2014 ${e.detail?.type || "unknown"}`);
        if (signalLog.length > 20) signalLog.shift();
        const logEl = document.getElementById("dt-signal-log");
        if (logEl) {
          logEl.innerHTML = signalLog.length ? signalLog.map((s) => `<div>${escapeHTMLId(s)}</div>`).join("") : '<div class="dt-empty">No signals yet</div>';
        }
      }));
      const sources = /* @__PURE__ */ new Set();
      document.querySelectorAll("[data-dsl-source]").forEach((el) => {
        sources.add(el.getAttribute("data-dsl-source"));
      });
      const srcList = document.getElementById("dt-source-list");
      if (srcList) {
        srcList.innerHTML = sources.size ? Array.from(sources).map((s) => `<div>\u{1F4CD} ${escapeHTMLId(s)}</div>`).join("") : '<div class="dt-empty">No source mappings (production build?)</div>';
      }
      updateIslands();
      setInterval(updateIslands, 2e3);
    };
    setTimeout(init, 100);
  }
  function escapeHTMLId(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  initDevTools();

  // src/runtime/runtime.ts
  var DSL = {
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
    exposeGlobals
  };
  window.__DSL__ = DSL;
  exposeGlobals();
  initLegacy();
})();
