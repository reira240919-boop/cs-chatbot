import { createBrowserClient } from "@supabase/ssr";

// スタッフ用の画面（ブラウザ）から使う。ログイン状態は cookie に入り、サーバー側でも読める
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
