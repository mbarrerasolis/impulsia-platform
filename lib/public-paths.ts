/** Rutas privadas (panel, portal, acceso): sin botón de WhatsApp, sin banner de cookies ni píxel. */
const privatePrefixes = ["/admin", "/portal", "/auth", "/forgot-password", "/login", "/pay"];

export function isPrivatePath(pathname: string) {
  return privatePrefixes.some((prefix) => pathname.startsWith(prefix));
}
