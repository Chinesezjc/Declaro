import type { ComponentBase, PageNode, RuntimeUser } from "../../dsl"

export function canAccessPage(page: PageNode, user?: RuntimeUser): boolean {
  return !page.role || user?.role === "admin" || user?.role === page.role
}

export function canRenderComponent(component: ComponentBase, user?: RuntimeUser): boolean {
  if (component.visible === false) {
    return false
  }

  if (!component.roles || component.roles.length === 0) {
    return true
  }

  return user?.role === "admin" || Boolean(user && component.roles.includes(user.role))
}
