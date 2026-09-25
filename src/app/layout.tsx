import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SyncOnReconnect } from "@/components/SyncOnReconnect";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock RSBB",
  description: "Aplikasi manajemen stok dan stock opname",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Stock RSBB",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f3" },
    { media: "(prefers-color-scheme: dark)", color: "#071214" },
  ],
};

// Runs before first paint so the saved theme (or the system one) and the
// saved sidebar state are applied without a flash or layout jump.
const themeScript = `(function(){try{var h=document.documentElement;var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;h.classList.toggle("dark",d);if(localStorage.getItem("sidebar")==="collapsed")h.dataset.sidebar="collapsed"}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SyncOnReconnect />
        {children}
      </body>
    </html>
  );
}
