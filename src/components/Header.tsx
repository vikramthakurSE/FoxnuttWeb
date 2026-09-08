"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import BusinessCodeLogin from "./BusinessCodeLogin";

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

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setAccount(d.session?.accountName ?? null))
      .catch(() => {});
  }, [pathname]);

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAccount(null);
  }

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="leading-tight">
          <span className="font-display text-xl font-bold text-terra block -mb-1">
            Nutty
          </span>
          <span className="font-display text-xl font-bold text-ink">
            Nirvana
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
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
              className="hidden sm:inline-block max-w-[9rem] truncate px-2.5 py-1.5 text-ink-soft hover:text-ink"
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
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative ml-1 inline-flex items-center justify-center h-10 w-10 rounded-full bg-terra text-cream hover:bg-terra-dark transition-colors"
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
        </nav>
      </div>

      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-4"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card border border-line shadow-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">Login</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Use the business code we sent you on WhatsApp.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowLogin(false)}
                className="-mt-1 text-2xl leading-none text-ink-soft hover:text-ink"
              >
                &times;
              </button>
            </div>
            <div className="mt-4">
              <BusinessCodeLogin
                onLoggedIn={(a) => {
                  setAccount(a.accountName);
                  setShowLogin(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
