import { answerCustomer, type ChatTurn, type Faq } from "./claude";
import { isBusinessHours } from "./business-hours";
import { createAdminClient } from "./supabase-admin";

const HANDOFF_IN_HOURS = "担当のスタッフにおつなぎします。このままお待ちください。";
const HANDOFF_OUT_OF_HOURS = "ただいま営業時間外（10〜18時）のため、翌営業日にスタッフからこちらでご返信します。";
const FALLBACK_REPLY = "申し訳ありません。ただいま自動でお答えできませんでした。";

// 会話の前のやりとりは、直近の分だけ渡す
const HISTORY_LIMIT = 20;

export type RespondResult =
  | { status: "replied"; escalated: boolean }
  | { status: "skipped"; reason: string };

export async function respondToConversation(conversationId: string, now = new Date()): Promise<RespondResult> {
  const admin = createAdminClient();

  const { data: conversation, error: convError } = await admin
    .from("conversations")
    .select("id, status, category")
    .eq("id", conversationId)
    .single();
  if (convError) throw convError;

  // スタッフに引き継いだあとは、AI は返事をしない（AI とスタッフが同時に答えないようにする）
  if (conversation.status !== "ai_handling") return { status: "skipped", reason: "AI が対応する状態ではない" };

  const { data: recent, error: msgError } = await admin
    .from("messages")
    .select("sender_type, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (msgError) throw msgError;

  const history = (recent as ChatTurn[]).reverse();
  // 最後がお客様のメッセージのときだけ答える（同じメッセージに 2 回答えない）
  while (history.length && history[0].sender_type !== "customer") history.shift();
  if (history.at(-1)?.sender_type !== "customer") return { status: "skipped", reason: "新しいお客様のメッセージがない" };

  const { data: faqs, error: faqError } = await admin
    .from("faqs")
    .select("category, question, answer")
    .order("created_at")
    .order("id");
  if (faqError) throw faqError;

  let answer = null;
  try {
    answer = await answerCustomer(history, faqs as Faq[]);
  } catch (error) {
    console.error("Claude API の呼び出しに失敗しました", error);
  }

  const escalate = answer?.escalate ?? true;
  const handoff = isBusinessHours(now) ? HANDOFF_IN_HOURS : HANDOFF_OUT_OF_HOURS;
  const reply = escalate ? `${answer?.reply ?? FALLBACK_REPLY}\n${handoff}` : answer!.reply;

  const { error: insertError } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_type: "ai", content: reply });
  if (insertError) throw insertError;

  const update: { status?: string; category?: string } = {};
  if (escalate) update.status = "waiting_operator";
  if (!conversation.category && answer) update.category = answer.category;
  if (Object.keys(update).length) {
    const { error: updateError } = await admin.from("conversations").update(update).eq("id", conversationId);
    if (updateError) throw updateError;
  }

  if (answer) console.log("AI の判断", { escalate, reason: answer.reason, category: answer.category });
  return { status: "replied", escalated: escalate };
}
