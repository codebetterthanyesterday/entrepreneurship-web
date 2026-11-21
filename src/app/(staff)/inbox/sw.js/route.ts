import { getCurrentUser } from "@/lib/session";

/**
 * The staff app's service worker (inbox phase 3), served from under /inbox so
 * that, like every staff address, a visitor without a session gets the same
 * 404 as a missing page. `Service-Worker-Allowed: /` lets it look after every
 * staff screen, not only /inbox.
 */
const SCRIPT = "// The staff app's service worker (inbox phase 3). It does one thing: show the\n// notifications the server pushes when something needs a person, and open the\n// right screen when one is tapped. No fetch handler: pages and data always\n// come from the network, as before.\n\nself.addEventListener(\"install\", () => self.skipWaiting());\nself.addEventListener(\"activate\", (event) => event.waitUntil(self.clients.claim()));\n\nself.addEventListener(\"push\", (event) => {\n  let message = { title: \"Bunny\u00e8\", body: \"Ada yang perlu ditangani\", href: \"/inbox\", tag: \"inbox\" };\n  try {\n    message = { ...message, ...event.data.json() };\n  } catch {\n    // A push without a readable body still says something needs a person.\n  }\n  event.waitUntil(\n    self.registration.showNotification(message.title, {\n      body: message.body,\n      tag: message.tag,\n      renotify: true,\n      icon: \"/brand/app-icon-192.png\",\n      badge: \"/brand/app-icon-192.png\",\n      data: { href: message.href },\n    }),\n  );\n});\n\nself.addEventListener(\"notificationclick\", (event) => {\n  event.notification.close();\n  const href = new URL(event.notification.data?.href ?? \"/inbox\", self.location.origin).href;\n  event.waitUntil(\n    (async () => {\n      const windows = await self.clients.matchAll({ type: \"window\", includeUncontrolled: true });\n      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);\n      if (open) {\n        await open.focus();\n        if (\"navigate\" in open) return open.navigate(href);\n        return undefined;\n      }\n      return self.clients.openWindow(href);\n    })(),\n  );\n});";

export async function GET(): Promise<Response> {
  if (!(await getCurrentUser())) return new Response("Not Found", { status: 404 });
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache",
    },
  });
}
