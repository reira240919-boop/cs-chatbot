import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// サーバー側の画面から、ログインしているスタッフとして使う（RLS が効く）
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        // 画面の表示中は cookie を書けない。ログインの更新は proxy.ts で行う
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}

export type Operator = { id: string; displayName: string };

// ログインしていて、スタッフの名簿に載っている人だけを返す
export async function getCurrentOperator(): Promise<Operator | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: operator } = await supabase
    .from("operators")
    .select("user_id, display_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return operator ? { id: operator.user_id, displayName: operator.display_name } : null;
}
