/**
 * Sends a dot from where an item was added to the cart in the navigation, and
 * gives the cart a nudge when it lands.
 *
 * Pure decoration on top of an update that has already happened — the toast
 * still announces it, and the count in the navigation already changed — so
 * every way out of it is silent: no target on screen, no Web Animations API, or
 * a reader who asked for less motion.
 */

const DURATION_MS = 720;

/** The cart's navigation item, carrying `data-nav-badge="cart"` in `NavBar`. */
function visibleCartTarget(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('[data-nav-badge="cart"]');
  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return null;
}

export function flyToCart(from: DOMRect | null | undefined): void {
  if (!from || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const target = visibleCartTarget();
  if (!target || typeof target.animate !== "function") return;

  const to = target.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - startX;
  const dy = to.top + to.height / 2 - startY;

  // The arc peaks above whichever end is higher, so a dot heading down to the
  // phone's bottom bar still rises first and a dot heading up to the tablet's
  // row does not dip.
  const peak = Math.min(0, dy) - 110;

  const dot = document.createElement("span");
  dot.className = "fly-dot";
  dot.setAttribute("aria-hidden", "true");
  dot.style.left = `${startX}px`;
  dot.style.top = `${startY}px`;
  document.body.append(dot);

  const flight = dot.animate(
    [
      { transform: "translate(0, 0) scale(0.6)", opacity: 0.9 },
      { transform: `translate(${dx * 0.45}px, ${peak}px) scale(1.2)`, opacity: 1, offset: 0.42 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.45)`, opacity: 0.85 },
    ],
    { duration: DURATION_MS, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
  );

  const land = () => {
    dot.remove();
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.16) rotate(-4deg)" },
        { transform: "scale(0.96) rotate(2deg)" },
        { transform: "scale(1)" },
      ],
      { duration: 460, easing: "ease-out" },
    );
  };

  flight.onfinish = land;
  flight.oncancel = () => dot.remove();
}
