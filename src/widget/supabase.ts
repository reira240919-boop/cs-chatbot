import { createClient } from "@supabase/supabase-js";

// 窓口に入れてよいのは publishable key だけ。中身は RLS で守る（secret key は入れない）
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      // ショップ側の保存内容とぶつからない名前にする
      storageKey: "botanica-chat-auth",
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
