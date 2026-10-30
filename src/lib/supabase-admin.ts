import { createClient } from "@supabase/supabase-js";

// サーバーだけで使う。secret key は RLS を通らないので、画面側のコードから読み込まない
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
