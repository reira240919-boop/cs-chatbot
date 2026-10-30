import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationStatus = "ai_handling" | "waiting_operator" | "operator_handling" | "closed";
export type SenderType = "customer" | "ai" | "operator";

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  created_at: string;
};

export type LastMessage = Pick<Message, "content" | "sender_type" | "created_at">;

export type Conversation = {
  id: string;
  customer_session_id: string;
  status: ConversationStatus;
  category: string | null;
  assigned_operator_id: string | null;
  created_at: string;
  last_message: LastMessage | null;
};

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  ai_handling: "AI 対応中",
  waiting_operator: "スタッフ待ち",
  operator_handling: "スタッフ対応中",
  closed: "終了",
};

const MESSAGE_COLUMNS = "id, conversation_id, sender_type, sender_id, content, created_at";
const LIST_LIMIT = 200;

// お客様は匿名なので、番号の頭 4 文字で見分ける
export function customerLabel(conversation: Pick<Conversation, "customer_session_id">): string {
  return `お客様 #${conversation.customer_session_id.slice(0, 4)}`;
}

export function lastActivity(conversation: Conversation): string {
  return conversation.last_message?.created_at ?? conversation.created_at;
}

export function sortByActivity(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

// 一覧。会話ごとに、いちばん新しいメッセージを 1 件だけ一緒に読む
export async function fetchConversations(supabase: SupabaseClient): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, customer_session_id, status, category, assigned_operator_id, created_at, messages(content, sender_type, created_at)")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return sortByActivity(
    data.map(({ messages, ...conversation }) => ({
      ...conversation,
      last_message: (messages as LastMessage[])[0] ?? null,
    })) as Conversation[],
  );
}

export async function fetchMessages(supabase: SupabaseClient, conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Message[];
}

export async function fetchOperatorNames(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("operators").select("user_id, display_name");
  if (error) throw error;
  return Object.fromEntries(data.map((o) => [o.user_id, o.display_name]));
}

// 対応を始める。状態を「スタッフ対応中」にして、担当を自分にする（AI はもう返事をしない）
export async function takeConversation(supabase: SupabaseClient, conversationId: string, operatorId: string) {
  const { error } = await supabase
    .from("conversations")
    .update({ status: "operator_handling", assigned_operator_id: operatorId })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function closeConversation(supabase: SupabaseClient, conversationId: string) {
  const { error } = await supabase.from("conversations").update({ status: "closed" }).eq("id", conversationId);
  if (error) throw error;
}

export async function sendOperatorReply(
  supabase: SupabaseClient,
  conversationId: string,
  operatorId: string,
  content: string,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_type: "operator", sender_id: operatorId, content })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data as Message;
}

export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function timeAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}
