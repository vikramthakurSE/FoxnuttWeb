export default function Footer() {
  return (
    <footer className="mt-16 bg-ink text-cream/90">
      <div className="mx-auto max-w-5xl px-4 py-10 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <p className="font-display text-lg font-bold text-cream">
            Nutty Nirvana Snacks
          </p>
          <p className="mt-2 text-cream/70">
            Katihar, Bihar 854105
            <br />
            Wholesome. Natural. Delightful.
          </p>
        </div>
        <div>
          <p className="font-semibold text-gold uppercase tracking-wide text-xs">
            Order &amp; Enquiries
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <a href="tel:+919008841421" className="hover:text-gold">
                Rohan — +91 90088 41421
              </a>
            </li>
            <li>
              <a href="tel:+917277474053" className="hover:text-gold">
                Vikram — +91 72774 74053
              </a>
            </li>
            <li>
              <a
                href="https://instagram.com/nutty_nirvana_snacks"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold"
              >
                @nutty_nirvana_snacks
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-gold uppercase tracking-wide text-xs">
            Good to know
          </p>
          <ul className="mt-2 space-y-1.5 text-cream/70">
            <li>FSSAI registered · food safety compliant</li>
            <li>Hand-picked &amp; sun-dried in Bihar</li>
            <li>Payment on delivery / as agreed</li>
            <li>Order updates arrive on WhatsApp</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/50">
        © {new Date().getFullYear()} Nutty Nirvana Snacks
      </div>
    </footer>
  );
}
