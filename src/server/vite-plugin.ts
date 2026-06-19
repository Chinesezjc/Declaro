// Vite HMR plugin for Declaro dev server.
// Watches dslPages for changes and pushes updated HTML to the browser.

import type { Plugin, ViteDevServer } from "vite"
import * as path from "node:path"
import { compilePage } from "../compiler/compile"
import type { PageNode } from "../dsl"

interface DslRoute {
  key: string
  path: string
  page: PageNode
}

export interface DeclaroHmrOptions {
  /** Function that returns the current route list */
  getRoutes: () => DslRoute[]
  /** Directory to watch for changes */
  pagesDir?: string
}

export function declaroHMRPlugin(options: DeclaroHmrOptions): Plugin {
  const pagesDir = options.pagesDir ?? "src/dslPages"

  return {
    name: "declaro-hmr",
    configureServer(server: ViteDevServer) {
      // Watch the pages directory for changes
      const watchPattern = `${pagesDir}/**/*.ts`
      server.watcher.add(watchPattern)

      server.watcher.on("change", async (filePath: string) => {
        const relPath = path.relative(process.cwd(), filePath)
        console.log(`\n🔄 Declaro HMR: ${relPath} changed, re-compiling...`)

        try {
          // Clear module cache for the changed file
          const absPath = path.resolve(filePath)
          delete require.cache[absPath]

          // Re-import the module to get fresh page definitions
          // In Vite, we use server.ssrLoadModule for fresh ESM imports
          // For now, invalidate the module in Vite's module graph
          const mod = server.moduleGraph.getModuleById(absPath)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
          }

          // Re-load routes (they'll be re-imported with fresh cache)
          const routes = options.getRoutes()

          // Compile each page and send updates
          for (const route of routes) {
            // Find which pages were affected by this file change
            // For simplicity, re-compile all pages
            const html = compilePage(route.page, {
              title: route.page.title,
              route: route.path,
            })

            // Push update to connected clients
            server.ws.send({
              type: "custom",
              event: "declaro:update",
              data: {
                path: route.path,
                html,
              },
            })
          }

          console.log("✓ Pages re-compiled and pushed to browser")
        } catch (err) {
          console.error("HMR compilation error:", err)
        }
      })
    },

    // Inject HMR client script in dev mode
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(
          "</body>",
          `<script>
// Declaro HMR client
if (import.meta.hot) {
  import.meta.hot.on('declaro:update', (data) => {
    if (data.path === window.location.pathname) {
      // Replace page content only, preserving the HMR connection
      var pageEl = document.querySelector('.dsl-page');
      if (pageEl) {
        var temp = document.createElement('div');
        temp.innerHTML = data.html;
        var newPage = temp.querySelector('.dsl-page');
        if (newPage) {
          pageEl.innerHTML = newPage.innerHTML;
          // Re-run scripts (they're inline, innerHTML won't execute them)
          var scripts = temp.querySelectorAll('script');
          scripts.forEach(function(s) {
            var newScript = document.createElement('script');
            if (s.src) newScript.src = s.src;
            else newScript.textContent = s.textContent;
            document.body.appendChild(newScript);
          });
          console.log('Declaro HMR: page updated');
        }
      } else {
        // Full page reload for non-DSL pages
        location.reload();
      }
    }
  });
}
</script>
</body>`,
        )
      },
    },
  }
}
