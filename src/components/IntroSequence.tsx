"use client";

import { useEffect, useRef, useState } from "react";
import { NnMark } from "./NnMonogram";

/**
 * First-visit title sequence on the home page: the monogram holds centre
 * screen, rushes through the camera, and the wordmark it leaves behind flies
 * into the header's brand slot.
 *
 * Whether it runs at all is decided before the body paints, by the inline
 * script in layout.tsx: it stamps data-nn-intro on <html> only on a first load
 * of "/" in this session, with reduced motion off. Every piece of chrome the
 * intro needs — the overlay itself, the hidden header brand, the scroll lock —
 * hangs off that attribute in globals.css, so there is no flash of the wrong
 * state and no intro at all without JS. Removing the attribute ends it.
 */

export default function IntroSequence() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.hasAttribute("data-nn-intro")) {
      setDone(true);
      return;
    }

    const root = rootRef.current;
    const brand = document.getElementById("nn-brand");
    const anims: Animation[] = [];
    let over = false;

    const finish = () => {
      if (over) return;
      over = true;
      for (const a of anims) {
        try {
          a.cancel();
        } catch {
          /* already gone */
        }
      }
      html.removeAttribute("data-nn-intro");
      setDone(true);
    };

    if (!root || !brand) {
      finish();
      return;
    }

    const markbox = root.querySelector<HTMLElement>(".nnx-markbox");
    const curtain = root.querySelector<HTMLElement>(".nnx-curtain");
    const flight = root.querySelector<HTMLElement>(".nnx-flight");
    const wm = root.querySelector<HTMLElement>(".nnx-wm");
    const line1 = root.querySelector<HTMLElement>(".nnx-l1");
    const line2 = root.querySelector<HTMLElement>(".nnx-l2");
    if (!markbox || !curtain || !flight || !wm || !line1 || !line2) {
      finish();
      return;
    }

    const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: "both", ...opts });
      anims.push(a);
      return a;
    };

    const run = () => {
      if (over) return;

      // The wordmark starts life exactly on top of the header's brand, then is
      // pushed out to the middle of the screen and scaled up; playing that
      // transform backwards is the flight, so it always lands pixel-perfect.
      const brandBox = brand.getBoundingClientRect();
      flight.style.left = `${brandBox.left}px`;
      flight.style.top = `${brandBox.top}px`;
      const wmBox = wm.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.max(
        1,
        Math.min((vw * 0.62) / wmBox.width, (vh * 0.34) / wmBox.height)
      );
      const dx = (vw - wmBox.width * scale) / 2 - brandBox.left;
      const dy = (vh - wmBox.height * scale) / 2 - brandBox.top;
      const away = `translate(${dx}px, ${dy}px) scale(${scale})`;
      const home = "translate(0px, 0px) scale(1)";
      flight.style.transform = away;

      // The disc rushes through the camera.
      play(
        markbox,
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1, filter: "blur(0px)", offset: 0 },
          { transform: "translate(-50%,-50%) scale(2.1)", opacity: 1, filter: "blur(1px)", offset: 0.42 },
          { transform: "translate(-50%,-50%) scale(9)", opacity: 0, filter: "blur(14px)", offset: 1 },
        ],
        { duration: 500, delay: 260, fill: "forwards", easing: "cubic-bezier(.5,0,.9,.6)" }
      );

      // The wordmark it leaves behind — held until the disc has actually gone,
      // so the two never share the screen.
      play(
        flight,
        [
          { opacity: 0, transform: `${away} translateY(8px)` },
          { opacity: 1, transform: away },
        ],
        { duration: 420, delay: 800, easing: "cubic-bezier(.22,.61,.36,1)" }
      );

      // Curtain lifts; the gold-and-ivory wordmark warms into the brand's own
      // colours on the way, which hides the hand-off to the real header.
      const t = 1450;
      // The curtain goes after the flight has started, not before: lifting it
      // first parks a full-size wordmark on top of the hero for half a second.
      play(curtain, [{ opacity: 1 }, { opacity: 0 }], {
        duration: 560,
        delay: t + 140,
        easing: "ease-in-out",
      });
      play(line1, [{ color: "#dcb264" }, { color: "#1f6b45" }], {
        duration: 560,
        delay: t + 200,
        easing: "ease-in-out",
      });
      play(line2, [{ color: "#f6f7f2" }, { color: "#1b2a21" }], {
        duration: 560,
        delay: t + 200,
        easing: "ease-in-out",
      });

      play(flight, [{ transform: away }, { transform: home }], {
        duration: 820,
        delay: t,
        easing: "cubic-bezier(.65,0,.35,1)",
      })
        .finished.then(finish)
        .catch(() => {
          /* cancelled by a skip */
        });
    };

    // Two things gate the timeline. Fraunces has to have landed, or the flight
    // would be measured against the fallback serif; and the monogram's CSS
    // entrance — which starts at first paint, well before this effect runs —
    // has to be over, so the rest is timed off the entrance rather than off
    // hydration, which drifts by a few hundred milliseconds.
    const entrance = markbox.getAnimations()[0];
    void Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      entrance?.finished ?? Promise.resolve(),
    ])
      .then(run)
      .catch(run);

    // Any deliberate input ends it — nobody should be held on a title card.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", finish);
    window.addEventListener("wheel", finish, { passive: true });
    window.addEventListener("touchstart", finish, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("wheel", finish);
      window.removeEventListener("touchstart", finish);
      finish();
    };
  }, []);

  if (done) return null;

  return (
    <div className="nnx-root" ref={rootRef} aria-hidden="true">
      <div className="nnx-curtain" />
      <div className="nnx-markbox">
        <NnMark size="100%" />
      </div>
      <div className="nnx-flight">
        <div className="nnx-wm leading-tight">
          <span className="nnx-l1 font-display text-xl font-bold block -mb-1">
            Nutty
          </span>
          <span className="nnx-l2 font-display text-xl font-bold">Nirvana</span>
        </div>
      </div>
    </div>
  );
}
