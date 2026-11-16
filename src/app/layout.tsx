import type { Metadata } from "next";
import { Kanit, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["latin", "thai"],
  variable: "--font-noto-thai",
  display: "swap",
});

const kanit = Kanit({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kanit",
  display: "swap",
});

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
      <body
        className={`${notoSansThai.variable} ${kanit.variable} antialiased selection:bg-kmutt-orange selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
