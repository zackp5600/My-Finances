import "./globals.css";

export const metadata = {
  title: "My Finances",
  description: "Take Control of your finances with our powerful portfolio analyzer. Track your investments, monitor performance, and make informed decisions to achieve your financial goals.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
