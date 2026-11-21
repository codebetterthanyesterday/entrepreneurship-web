import { getCurrentUser } from "@/lib/session";

/**
 * The staff app's manifest, so it can be added to an iPhone's home screen,
 * the only way iOS lets a web app receive push. Under /inbox and signed-in
 * only, like every staff address; the layout fetches it with credentials.
 */
const MANIFEST = {
  "id": "/inbox",
  "name": "Bunny\u00e8 Staf",
  "short_name": "Bunny\u00e8 Staf",
  "description": "Panel staf Bunny\u00e8: inbox, kasir, dapur, dan admin.",
  "lang": "id",
  "start_url": "/inbox",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fff6e8",
  "theme_color": "#1f2a5c",
  "icons": [
    {
      "src": "/brand/app-icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/brand/app-icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/brand/app-icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
};

export async function GET(): Promise<Response> {
  if (!(await getCurrentUser())) return new Response("Not Found", { status: 404 });
  return Response.json(MANIFEST, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
