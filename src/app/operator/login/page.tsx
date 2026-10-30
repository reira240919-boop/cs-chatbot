"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

const LOGIN_ERROR = "メールアドレスかパスワードが違います。";
const NOT_OPERATOR_ERROR = "スタッフとして登録されていないため、入れません。";

export default function OperatorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createBrowserSupabase();

    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError || !data.user) {
      setError(LOGIN_ERROR);
      setSubmitting(false);
      return;
    }

    // パスワードが合っていても、スタッフの名簿に載っていなければ入れない
    const { data: operator } = await supabase.from("operators").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!operator) {
      await supabase.auth.signOut();
      setError(NOT_OPERATOR_ERROR);
      setSubmitting(false);
      return;
    }

    router.replace("/operator");
    router.refresh();
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-lg font-bold">ボタニカ お問い合わせ対応</h1>
        <p className="mt-1 text-sm text-muted">スタッフ用のログイン</p>

        <label className="mt-6 block text-sm font-bold" htmlFor="email">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 outline-primary"
        />

        <label className="mt-4 block text-sm font-bold" htmlFor="password">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 outline-primary"
        />

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 font-bold text-white disabled:opacity-50"
        >
          {submitting ? "確認しています…" : "ログイン"}
        </button>
      </form>
    </main>
  );
}
