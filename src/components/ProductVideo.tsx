"use client";

import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/productMorph";

/**
 * Plays public/products/<slug>.mp4 over the product photo when one exists
 * (renders nothing when it doesn't). The photo underneath stays visible
 * until the video is actually playing, then the video fades in.
 *
 * Normally it autoplays muted on a loop once `start` is true, with a sound
 * toggle, and pauses while scrolled out of view. Visitors who prefer reduced
 * motion or have data saver on get a "Watch video" button instead.
 */
export default function ProductVideo({
  slug,
  name,
  start,
}: {
  slug: string;
  name: string;
  start: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [available, setAvailable] = useState(false);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    setAuto(!reducedMotion() && connection?.saveData !== true);
  }, []);

  // Autoplay once the page reveal is done; pause while out of view.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !start || !auto || missing) return;
    video.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [start, auto, missing]);

  if (missing || auto === null) return null;

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !muted;
    setMuted(!muted);
  }

  function watch() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    setMuted(false);
    video.play().catch(() => {});
  }

  return (
    <>
      <video
        ref={videoRef}
        src={`/products/${slug}.mp4`}
        aria-label={`${name} video`}
        playsInline
        loop={auto}
        preload={auto ? "auto" : "metadata"}
        onLoadedMetadata={() => setAvailable(true)}
        onError={() => setMissing(true)}
        onPlaying={() => setPlaying(true)}
        onEnded={() => {
          setPlaying(false);
          setMuted(true);
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      />

      {auto && playing && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Turn sound on" : "Mute video"}
          className="absolute bottom-3 right-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/45 px-3 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            {muted ? (
              <path d="m22 9-6 6M16 9l6 6" />
            ) : (
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
            )}
          </svg>
          {muted ? "Tap for sound" : "Mute"}
        </button>
      )}

      {!auto && available && !playing && (
        <button
          type="button"
          onClick={watch}
          className="absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-black/25 to-transparent pb-4"
        >
          <span className="inline-flex h-12 items-center gap-2 rounded-full bg-white/90 px-5 text-sm font-semibold text-ink shadow-card">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch video
          </span>
        </button>
      )}
    </>
  );
}
