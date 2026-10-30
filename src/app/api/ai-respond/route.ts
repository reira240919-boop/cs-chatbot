import { respondToConversation } from "@/lib/ai-respond";
import { createAdminClient } from "@/lib/supabase-admin";

// チャット窓口は Shopify のショップ（別のサイト）の上で動くので、外から呼べるようにする。
// 本人かどうかは、Cookie ではなく匿名ログインのトークンで確かめるため、呼べるサイトは絞らない
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return json({ error: "ログインが必要です" }, 401);

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  if (!conversationId) return json({ error: "conversationId がありません" }, 400);

  const admin = createAdminClient();
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "ログインが必要です" }, 401);

  // 自分の会話でなければ、AI を呼ばない（他人の会話で AI を動かして利用料をかさませない）
  const { data: own } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("customer_session_id", auth.user.id)
    .maybeSingle();
  if (!own) return json({ error: "この会話は操作できません" }, 403);

  try {
    return json(await respondToConversation(conversationId));
  } catch (error) {
    console.error("AI の返事を作れませんでした", error);
    return json({ error: "AI の返事を作れませんでした" }, 500);
  }
}
