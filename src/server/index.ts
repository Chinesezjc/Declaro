import express from "express"
import { dslRoutes } from "../app/routes"
import { compilePage } from "../compiler/compile"
import {
  handleApproveApplication,
  handleFormSubmit,
  handleGetApplications,
  handleGetStudents,
  handleRejectApplication,
  handleSubmitApplication,
  handleExportGroups,
} from "./api"

const app = express()
const PORT = process.env.PORT ?? 3000

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ===== Page cache =====
const pageCache = new Map<string, string>()

function getOrCompilePage(routeKey: string): string | null {
  const cached = pageCache.get(routeKey)
  if (cached) return cached

  const route = dslRoutes.find((r) => r.key === routeKey)
  if (!route) return null

  const html = compilePage(route.page, { title: route.page.title, route: route.path })
  pageCache.set(routeKey, html)
  return html
}

// Pre-compile all pages on startup
console.log("Pre-compiling pages...")
for (const route of dslRoutes) {
  const html = compilePage(route.page, { title: route.page.title, route: route.path })
  pageCache.set(route.key, html)
  console.log(`  ✓ ${route.key} → ${route.path}`)
}

// ===== Page routes =====
for (const route of dslRoutes) {
  app.get(route.path, (_req, res) => {
    const html = pageCache.get(route.key)
    if (html) {
      res.send(html)
    } else {
      res.status(500).send(`<h1>Page not compiled: ${route.key}</h1>`)
    }
  })
}

// Root redirect
app.get("/", (_req, res) => {
  const firstRoute = dslRoutes[0]
  if (firstRoute) {
    res.redirect(firstRoute.path)
  } else {
    res.send("<h1>Declaro</h1><p>No pages registered.</p>")
  }
})

// ===== Data API routes =====
app.get("/api/students", handleGetStudents)
app.get("/api/applications", handleGetApplications)
app.post("/api/applications", handleSubmitApplication)
app.post("/api/applications/approve", handleApproveApplication)
app.post("/api/applications/reject", handleRejectApplication)
app.get("/api/groups/export", handleExportGroups)

// Generic form endpoint
app.post("/api/form/:formId", handleFormSubmit)

// ===== Start =====
app.listen(PORT, () => {
  console.log(`\n🚀 Declaro server running at http://localhost:${PORT}`)
  console.log("Pages:")
  for (const route of dslRoutes) {
    console.log(`  http://localhost:${PORT}${route.path} → ${route.label}`)
  }
})

export default app
