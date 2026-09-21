import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { DeliveryProvider } from "@/components/DeliveryProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NnCornerBadge from "@/components/NnMonogram";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nutty Nirvana Snacks — Premium Makhana from Bihar",
    template: "%s · Nutty Nirvana Snacks",
  },
  description:
    "Hand-picked, sun-dried fox nuts (makhana). Order Holiday, Laddu Gopal, Gopala and loose bulk makhana directly from us.",
};

export const viewport: Viewport = {
  themeColor: "#f6f7f2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="paper min-h-screen flex flex-col">
        {/* Decides whether the home page's title sequence runs, before the body
            paints — see IntroSequence.tsx. Marking the session here rather than
            when the animation ends means a reload mid-intro goes straight to
            the page. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(location.pathname==='/'&&!sessionStorage.getItem('nn-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.setAttribute('data-nn-intro','');sessionStorage.setItem('nn-intro','1')}}catch(e){}",
          }}
        />
        <CartProvider>
          <DeliveryProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <NnCornerBadge />
          </DeliveryProvider>
        </CartProvider>
      </body>
    </html>
  );
}
