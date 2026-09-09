"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import LoginModal from "./LoginModal";

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
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="leading-tight" onClick={() => setMenuOpen(false)}>
          <span className="font-display text-xl font-bold text-terra block -mb-1">
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
                  ? "bg-ink text-cream"
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
          <CartButton ready={ready} count={count} />
        </nav>

        {/* Mobile actions */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <CartButton ready={ready} count={count} />
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-line text-ink hover:bg-cream-2 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M4 12h16" />
                  <path d="M4 6h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <nav className="sm:hidden border-t border-line bg-cream/98 backdrop-blur px-4 py-3">
          <ul className="flex flex-col gap-1 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`block rounded-xl px-3 py-2.5 transition-colors ${
                    pathname === l.href
                      ? "bg-ink text-cream"
                      : "text-ink-soft hover:bg-cream-2 hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-2">
              {account ? (
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="w-full text-left rounded-xl px-3 py-2.5 text-ink-soft hover:bg-cream-2 hover:text-ink transition-colors"
                >
                  <span className="block text-xs text-ink-soft/70">
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
                  className="w-full text-left rounded-xl px-3 py-2.5 text-ink-soft hover:bg-cream-2 hover:text-ink transition-colors"
                >
                  Login
                </button>
              )}
            </li>
          </ul>
        </nav>
      )}

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
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-terra text-cream hover:bg-terra-dark transition-colors"
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
