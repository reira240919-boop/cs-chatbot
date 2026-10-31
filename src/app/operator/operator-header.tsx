"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Operator } from "@/lib/supabase-server";

export const PAGE_TITLE = "ボタニカ お問い合わせ対応";

const SECTIONS = [
  { href: "/operator", label: "お問い合わせ" },
  { href: "/operator/faqs", label: "よくある質問" },
] as const;

export type Section = (typeof SECTIONS)[number]["href"];

// スタッフ用の画面の上の部分。いまいる画面に背景色を付ける
export function OperatorHeader({ operator, current }: { operator: Operator; current: Section }) {
  const router = useRouter();

  const logout = async () => {
    await createBrowserSupabase().auth.signOut();
    router.replace("/operator/login");
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="hidden truncate font-bold md:block">{PAGE_TITLE}</h1>
        <nav aria-label="画面の切りかえ" className="flex gap-1">
          {SECTIONS.map((section) => {
            const selected = section.href === current;
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={selected ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold ${
                  selected ? "bg-primary-soft text-primary" : "text-muted hover:bg-canvas"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        <span className="hidden text-muted sm:inline">{operator.displayName} さん</span>
        <button
          type="button"
          onClick={logout}
          className="whitespace-nowrap rounded-lg border border-danger px-3 py-1.5 font-bold text-danger"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
