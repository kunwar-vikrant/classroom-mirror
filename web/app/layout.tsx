import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classroom Mirror — See the lesson before you teach it",
  description: "Preflight a lesson through four focused learner perspectives, catch misconceptions, and redesign the learning path with GPT-5.6.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Classroom Mirror",
    description: "See the lesson through every learner’s eyes.",
    type: "website",
    images: [{ url: "/og.png", width: 1728, height: 910, alt: "Classroom Mirror — See the lesson through every learner’s eyes" }],
  },
  twitter: { card: "summary_large_image", title: "Classroom Mirror", description: "See the lesson through every learner’s eyes.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

