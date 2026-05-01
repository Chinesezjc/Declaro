import { useCallback, useEffect, useState } from "react"
import { DslDemoShell } from "./app/DslDemoShell"
import { dslRoutes, getDslRouteByPath, type DslRoute } from "./app/routes"

function getCurrentRoute(): DslRoute {
  return getDslRouteByPath(window.location.pathname) ?? dslRoutes[0]
}

export default function App() {
  const [route, setRoute] = useState<DslRoute>(() => getCurrentRoute())

  useEffect(() => {
    if (!getDslRouteByPath(window.location.pathname)) {
      window.history.replaceState({}, "", dslRoutes[0].path)
    }

    const handlePopState = () => {
      setRoute(getCurrentRoute())
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const handleRouteChange = useCallback((nextRoute: DslRoute) => {
    if (window.location.pathname !== nextRoute.path) {
      window.history.pushState({}, "", nextRoute.path)
    }

    setRoute(nextRoute)
  }, [])

  return <DslDemoShell activePageKey={route.key} mode="routes" showIr onRouteChange={handleRouteChange} />
}
