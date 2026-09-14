import Link from "next/link";

/** The one number customers should call or WhatsApp. Change it here only. */
const CONTACT_PHONE = "919620405311";
const CONTACT_PHONE_DISPLAY = "+91 96204 05311";
const INSTAGRAM = "nutty_nirvana_snacks";

const SHOP_LINKS = [
  { href: "/products", label: "Products" },
  { href: "/orders", label: "My orders" },
  { href: "/cart", label: "Cart" },
];

export default function Footer() {
  return (
    <footer className="mt-16 bg-ink text-mist/90">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-8">
        {/* Contact us */}
        <section
          aria-labelledby="footer-contact"
          className="rounded-3xl border border-mist/10 bg-mist/[0.04] p-6 sm:p-8 sm:flex sm:items-center sm:justify-between sm:gap-8"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Contact us
            </p>
            <h2
              id="footer-contact"
              className="mt-2 font-display text-2xl sm:text-3xl font-bold text-mist"
            >
              We&apos;re a call or a message away
            </h2>
            <p className="mt-2 max-w-md text-sm text-mist/65">
              Questions about an order, bulk pricing or private label? Call or
              WhatsApp us and we&apos;ll get back to you quickly.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:mt-0 sm:min-w-[15rem]">
            <a
              href={`tel:+${CONTACT_PHONE}`}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-pine px-6 font-semibold text-mist transition-colors hover:bg-pine-dark"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
              </svg>
              {CONTACT_PHONE_DISPLAY}
            </a>
            <a
              href={`https://wa.me/${CONTACT_PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full border border-mist/20 px-6 font-semibold text-mist transition-colors hover:bg-mist/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
              </svg>
              WhatsApp us
            </a>
          </div>
        </section>

        {/* Columns */}
        <div className="mt-10 grid gap-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold text-mist">
              Nutty Nirvana Snacks
            </p>
            <p className="mt-2 text-mist/65">Wholesome. Natural. Delightful.</p>
            <a
              href={`https://instagram.com/${INSTAGRAM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-mist/80 transition-colors hover:text-gold"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              @{INSTAGRAM}
            </a>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Shop
            </p>
            <ul className="mt-3 space-y-2">
              {SHOP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-mist/80 transition-colors hover:text-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Good to know
            </p>
            <ul className="mt-3 space-y-2 text-mist/65">
              <li>FSSAI registered · food safety compliant</li>
              <li>Hand-picked &amp; sun-dried</li>
              <li>Pay online by UPI or cash on delivery</li>
              <li>Order updates arrive on WhatsApp</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-mist/10 py-4 text-center text-xs text-mist/50">
        © {new Date().getFullYear()} Nutty Nirvana Snacks
      </div>
    </footer>
  );
}
