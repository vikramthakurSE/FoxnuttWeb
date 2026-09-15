/**
 * Product card ⇄ product page transition.
 *
 * Opening: the card lifts its photo tile slightly and leaves a fixed copy of
 * it (#nnp-lift) on screen while the product route loads. The product page
 * takes over from that copy: a brand-coloured layer (#nnp-bloom) grows from
 * the card's rectangle to fill the left panel while the photo flies into
 * place and zooms up.
 *
 * Closing plays it backwards and leaves the shrunken layer, with a copy of
 * the photo, over the card until the card re-mounts and settles its tile.
 *
 * Both nodes live on document.body so they survive client-side navigation.
 */

export const MORPH_EASE = "cubic-bezier(.65,0,.2,1)";

const LIFT_ID = "nnp-lift";
const BLOOM_ID = "nnp-bloom";
const LIFT_SCALE = 1.03;

/** The lifted card photo's box, in viewport pixels. */
export interface MorphOrigin {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Step 1, on the card. Resolves once the tile has lifted. */
export async function liftCard(tile: HTMLElement, slug: string): Promise<void> {
  document.getElementById(LIFT_ID)?.remove();

  const r = tile.getBoundingClientRect();
  const lift = tile.cloneNode(true) as HTMLElement;
  lift.id = LIFT_ID;
  lift.dataset.slug = slug;
  lift.dataset.left = String(r.left - (r.width * (LIFT_SCALE - 1)) / 2);
  lift.dataset.top = String(r.top - (r.height * (LIFT_SCALE - 1)) / 2);
  lift.dataset.width = String(r.width * LIFT_SCALE);
  lift.dataset.height = String(r.height * LIFT_SCALE);
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

  try {
    await lift.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${LIFT_SCALE})` }],
      { duration: 180, easing: MORPH_EASE, fill: "forwards" },
    ).finished;
  } catch {
    // Removed mid-lift; nothing left to wait for.
  }
}

/** Step 2, on the product page: take over from the lifted card copy. */
export function takeLift(slug: string): MorphOrigin | null {
  const lift = document.getElementById(LIFT_ID);
  if (!lift) return null;
  lift.remove();
  if (lift.dataset.slug !== slug) return null;
  return {
    left: Number(lift.dataset.left),
    top: Number(lift.dataset.top),
    width: Number(lift.dataset.width),
    height: Number(lift.dataset.height),
  };
}

/** A full-viewport brand-coloured layer for the product page to clip. */
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
    backgroundColor: color,
  });
  document.body.appendChild(bloom);
  return bloom;
}

/** Step 3, back on the card: settle the tile where the layer shrank to. */
export function dropOntoCard(tile: HTMLElement, slug: string): void {
  const bloom = document.getElementById(BLOOM_ID);
  if (!bloom || bloom.dataset.slug !== slug) return;
  bloom.remove();
  if (reducedMotion()) return;

  tile.animate(
    [{ transform: `scale(${LIFT_SCALE})` }, { transform: "none" }],
    { duration: 260, easing: MORPH_EASE },
  );
}
