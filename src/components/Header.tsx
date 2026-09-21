"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "./CartProvider";
import LoginModal from "./LoginModal";
import PincodeChip from "./PincodeChip";

const links = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "My Orders" },
];

export default function Header() {
  const { count, ready } = useCart();
  const pathname = usePathname();
  const [account, setAccount] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Keeps the overlay mounted for the closing transition after menuOpen
  // flips back to false.
  const [menuMounted, setMenuMounted] = useState(false);
  // Applied a frame after mounting. An element created with its open styles
  // already on has nothing to transition from, so it would pop in.
  const [menuVisible, setMenuVisible] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setMenuVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setMenuVisible(false);
    const t = setTimeout(() => setMenuMounted(false), 380);
    return () => clearTimeout(t);
  }, [menuOpen]);

  // Escape closes; the page behind stays still while the menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setAccount(d.session?.accountName ?? null))
      .catch(() => {});
  }, [pathname]);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAccount(null);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 bg-mist/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
        <Link id="nn-brand" href="/" className="leading-tight" onClick={() => setMenuOpen(false)}>
          <span className="font-display text-xl font-bold text-pine block -mb-1">
            Nutty
          </span>
          <span className="font-display text-xl font-bold text-ink">
            Nirvana
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-2 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-2.5 py-1.5 rounded-full transition-colors ${
                pathname === l.href
                  ? "bg-ink text-mist"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {account ? (
            <button
              type="button"
              onClick={() => void logout()}
              title={`Signed in as ${account}`}
              className="max-w-[9rem] truncate px-2.5 py-1.5 text-ink-soft hover:text-ink"
            >
              {account}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="px-2.5 py-1.5 rounded-full text-ink-soft hover:text-ink"
            >
              Login
            </button>
          )}
          <PincodeChip />
          <CartButton ready={ready} count={count} />
        </nav>

        {/* Mobile actions */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <PincodeChip />
          <CartButton ready={ready} count={count} />
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="nn-mobile-menu"
            className={`nnm-burger relative inline-flex items-center justify-center h-10 w-10 rounded-full border border-line text-ink hover:bg-mist-2 transition-colors ${menuOpen ? "nnm-burger-open bg-mist-2" : ""}`}
          >
            <span className="nnm-bar nnm-bar-1" />
            <span className="nnm-bar nnm-bar-2" />
            <span className="nnm-bar nnm-bar-3" />
          </button>
        </div>
      </div>

      {/* Mobile menu: an overlay below the header, so the page never shifts. */}
      {portalReady &&
        menuMounted &&
        createPortal(
          <div
            className={`nnm-overlay sm:hidden ${menuVisible ? "nnm-open" : ""}`}
            aria-hidden={!menuOpen}
          >
            <div className="nnm-backdrop" onClick={() => setMenuOpen(false)} />
            <nav id="nn-mobile-menu" className="nnm-panel" aria-label="Main menu">
              <ul className="flex flex-col gap-1 text-[15px]">
                {links.map((l, i) => (
                  <li key={l.href} className="nnm-item" style={{ transitionDelay: menuVisible ? `${90 + i * 55}ms` : "0ms" }}>
                    <Link
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-colors ${
                        pathname === l.href
                          ? "bg-ink text-mist"
                          : "text-ink hover:bg-mist-2"
                      }`}
                    >
                      {l.label}
                      <span aria-hidden="true" className={pathname === l.href ? "text-mist/60" : "text-ink-soft/50"}>→</span>
                    </Link>
                  </li>
                ))}
                <li
                  className="nnm-item mt-1 border-t border-line pt-2"
                  style={{ transitionDelay: menuVisible ? `${90 + links.length * 55}ms` : "0ms" }}
                >
                  {account ? (
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="w-full text-left rounded-2xl px-4 py-3 text-ink hover:bg-mist-2 transition-colors"
                    >
                      <span className="block text-xs text-ink-soft">
                        Signed in as {account}
                      </span>
                      Log out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowLogin(true);
                      }}
                      className="w-full text-left rounded-2xl px-4 py-3 text-ink hover:bg-mist-2 transition-colors"
                    >
                      Login
                    </button>
                  )}
                </li>
              </ul>
            </nav>
          </div>,
          document.body
        )}

      <style>{`
        .nnm-bar {
          position: absolute; left: 50%; top: 50%; width: 18px; height: 2px; margin-left: -9px;
          border-radius: 2px; background: currentColor;
          transition: transform .38s cubic-bezier(.65,0,.35,1), opacity .2s ease;
        }
        .nnm-bar-1 { transform: translateY(-6px); }
        .nnm-bar-2 { transform: translateY(0); }
        .nnm-bar-3 { transform: translateY(6px); }
        .nnm-burger-open .nnm-bar-1 { transform: translateY(0) rotate(45deg); }
        .nnm-burger-open .nnm-bar-2 { opacity: 0; transform: scaleX(.2); }
        .nnm-burger-open .nnm-bar-3 { transform: translateY(0) rotate(-45deg); }

        .nnm-overlay { position: fixed; left: 0; right: 0; top: 64px; bottom: 0; z-index: 35; }
        .nnm-backdrop {
          position: absolute; inset: 0;
          background: rgba(27,42,33,.18);
          -webkit-backdrop-filter: blur(0px); backdrop-filter: blur(0px);
          opacity: 0;
          transition: opacity .35s ease, backdrop-filter .35s ease, -webkit-backdrop-filter .35s ease;
        }
        .nnm-open .nnm-backdrop { opacity: 1; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }

        .nnm-panel {
          position: absolute; left: 12px; right: 12px; top: 8px;
          padding: 10px; border-radius: 22px;
          background: rgba(255,255,255,.97); border: 1px solid #dde3d6;
          box-shadow: 0 24px 48px -20px rgba(27,42,33,.45);
          transform-origin: top right;
          opacity: 0; transform: translateY(-10px) scale(.96);
          transition: opacity .28s ease, transform .38s cubic-bezier(.34,1.25,.64,1);
        }
        .nnm-open .nnm-panel { opacity: 1; transform: none; }

        .nnm-item { opacity: 0; transform: translateY(-6px); transition: opacity .3s ease, transform .35s cubic-bezier(.34,1.3,.64,1); }
        .nnm-open .nnm-item { opacity: 1; transform: none; }

        @media (prefers-reduced-motion: reduce) {
          .nnm-bar, .nnm-backdrop, .nnm-panel, .nnm-item { transition: none; }
        }
      `}</style>

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onLoggedIn={(a) => {
          setAccount(a.accountName);
          setShowLogin(false);
        }}
      />
    </header>
  );
}

function CartButton({ ready, count }: { ready: boolean; count: number }) {
  return (
    <Link
      href="/cart"
      aria-label="Cart"
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-pine text-mist hover:bg-pine-dark transition-colors"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {ready && count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-gold text-[11px] font-bold text-ink flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
