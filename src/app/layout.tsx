import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeatMatrix - Smart Indian Railways Seat Availability",
  description:
    "Intelligently visualize and optimize train seat availability for Indian Railways journeys with interactive seat maps and smart recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
