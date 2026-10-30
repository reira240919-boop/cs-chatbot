import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ボタニカ お問い合わせ対応",
  description: "ボタニカのスタッフ用の、お問い合わせチャットの対応画面",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
