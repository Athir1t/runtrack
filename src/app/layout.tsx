import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KMUTT Athletics × Tumpang Games | เช็คการซ้อม",
  description: "ระบบติดตามการซ้อมตามโปรแกรมสำหรับนักกีฬา KMUTT Athletics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark">
      <body className="antialiased selection:bg-kmutt-orange selection:text-white">
        {children}
      </body>
    </html>
  );
}
