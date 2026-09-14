/**
 * Product card ⇄ product page "circle" transition.
 *
 * Opening: the card clips its photo tile into a circle and leaves a fixed
 * copy of it (#nnp-lift) breathing on screen while the product route loads.
 * The product page takes over from that copy: a brand-coloured disc
 * (#nnp-bloom) grows out of it to fill the left panel while the logo flies
 * into place.
 *
 * Closing plays it backwards and leaves the shrunken disc, with a copy of
 * the logo, over the card until the card re-mounts and opens its tile back
 * out of the circle.
 *
 * Both nodes live on document.body so they survive client-side navigation.
 */

export const MORPH_EASE = "cubic-bezier(.65,0,.2,1)";

const LIFT_ID = "nnp-lift";
const BLOOM_ID = "nnp-bloom";
const LIFT_SCALE = 1.08;
const FULL_INSET = "inset(0px 0px 0px 0px round 0px)";

export interface MorphOrigin {
  /** Centre of the circle, in viewport pixels. */
  x: number;
  y: number;
  /** Diameter of the circle. */
  d: number;
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The largest centred circle inside a w×h box, as an inset() shape. */
function circleInset(w: number, h: number): string {
  const d = Math.min(w, h);
  const iy = (h - d) / 2;
  const ix = (w - d) / 2;
  return `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${d / 2}px)`;
}

/** Step 1, on the card. Resolves once the tile has become a circle. */
export async function liftCard(tile: HTMLElement, slug: string): Promise<void> {
  document.getElementById(LIFT_ID)?.remove();

  const r = tile.getBoundingClientRect();
  const lift = tile.cloneNode(true) as HTMLElement;
  lift.id = LIFT_ID;
  lift.dataset.slug = slug;
  lift.dataset.x = String(r.left + r.width / 2);
  lift.dataset.y = String(r.top + r.height / 2);
  lift.dataset.d = String(Math.min(r.width, r.height) * LIFT_SCALE);
  lift.setAttribute("aria-hidden", "true");
  Object.assign(lift.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
  });
  document.body.appendChild(lift);
  tile.style.visibility = "hidden";

  // Never strand the copy if the navigation doesn't happen.
  setTimeout(() => {
    if (lift.isConnected) {
      lift.remove();
      tile.style.visibility = "";
    }
  }, 12000);

  const circle = circleInset(r.width, r.height);
  try {
    await lift.animate(
      [
        { clipPath: FULL_INSET, transform: "scale(1)" },
        { clipPath: circle, transform: "scale(.94)", offset: 0.6 },
        { clipPath: circle, transform: `scale(${LIFT_SCALE})` },
      ],
      { duration: 420, easing: MORPH_EASE, fill: "forwards" },
    ).finished;
  } catch {
    return;
  }

  // Breathe gently while the product page loads.
  lift.animate(
    [
      { transform: `scale(${LIFT_SCALE})` },
      { transform: `scale(${LIFT_SCALE * 0.97})` },
    ],
    {
      duration: 650,
      direction: "alternate",
      iterations: Infinity,
      easing: "ease-in-out",
    },
  );
}

/** Step 2, on the product page: take over from the lifted card copy. */
export function takeLift(slug: string): MorphOrigin | null {
  const lift = document.getElementById(LIFT_ID);
  if (!lift) return null;
  lift.remove();
  if (lift.dataset.slug !== slug) return null;
  return {
    x: Number(lift.dataset.x),
    y: Number(lift.dataset.y),
    d: Number(lift.dataset.d),
  };
}

/**
 * A full-viewport layer for the product page to animate: clip the layer
 * itself with inset() and its child disc with circle().
 */
export function createBloom(color: string, slug: string): HTMLElement {
  document.getElementById(BLOOM_ID)?.remove();

  const bloom = document.createElement("div");
  bloom.id = BLOOM_ID;
  bloom.dataset.slug = slug;
  bloom.setAttribute("aria-hidden", "true");
  Object.assign(bloom.style, {
    position: "fixed",
    inset: "0",
    zIndex: "30",
    pointerEvents: "none",
  });

  const disc = document.createElement("div");
  Object.assign(disc.style, {
    position: "absolute",
    inset: "0",
    backgroundColor: color,
  });

  bloom.appendChild(disc);
  document.body.appendChild(bloom);
  return bloom;
}

/** Step 3, back on the card: open the tile out of the circle left behind. */
export function dropOntoCard(tile: HTMLElement, slug: string): void {
  const bloom = document.getElementById(BLOOM_ID);
  if (!bloom || bloom.dataset.slug !== slug) return;
  bloom.remove();
  if (reducedMotion()) return;

  const r = tile.getBoundingClientRect();
  tile.animate(
    [
      {
        clipPath: circleInset(r.width, r.height),
        transform: `scale(${LIFT_SCALE})`,
      },
      { clipPath: FULL_INSET, transform: "none" },
    ],
    { duration: 480, easing: MORPH_EASE },
  );
}
