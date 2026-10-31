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

// conversations 表の check と同じ並び
export const CATEGORIES = ["在庫", "配送", "返品", "商品質問", "その他"] as const;

const MESSAGE_COLUMNS = "id, conversation_id, sender_type, sender_id, content, created_at";
const CONVERSATION_COLUMNS =
  "id, customer_session_id, status, category, assigned_operator_id, created_at, messages(content, sender_type, created_at)";
// 終わった会話は増え続けるので、一度に読む件数を区切る
export const CLOSED_PAGE_SIZE = 50;
export const SEARCH_LIMIT = 100;

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

// 会話ごとに、いちばん新しいメッセージを 1 件だけ一緒に読む
function selectWithLastMessage(supabase: SupabaseClient) {
  return supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });
}

function toConversations(data: ({ messages: unknown } & Record<string, unknown>)[]): Conversation[] {
  return data.map(({ messages, ...conversation }) => ({
    ...conversation,
    last_message: (messages as LastMessage[])[0] ?? null,
  })) as Conversation[];
}

// 終わっていない会話は、スタッフ待ちを見落とさないよう全部読む
export async function fetchOpenConversations(supabase: SupabaseClient): Promise<Conversation[]> {
  const { data, error } = await selectWithLastMessage(supabase)
    .neq("status", "closed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return toConversations(data);
}

// 終わった会話は、新しいものから CLOSED_PAGE_SIZE 件ずつ読む
export async function fetchClosedConversations(supabase: SupabaseClient, offset: number): Promise<Conversation[]> {
  const { data, error } = await selectWithLastMessage(supabase)
    .eq("status", "closed")
    .order("created_at", { ascending: false })
    .range(offset, offset + CLOSED_PAGE_SIZE - 1);
  if (error) throw error;
  return toConversations(data);
}

export type SearchCondition = { keyword: string; category: string };

// 言葉は、お客様・AI・スタッフのどのメッセージに入っていても当たる
export async function searchConversations(supabase: SupabaseClient, { keyword, category }: SearchCondition): Promise<Conversation[]> {
  let ids: string[] | null = null;
  if (keyword) {
    const pattern = `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;
    const { data, error } = await supabase
      .from("messages")
      .select("conversation_id")
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    ids = [...new Set(data.map((m) => m.conversation_id as string))].slice(0, SEARCH_LIMIT);
    if (ids.length === 0) return [];
  }

  let query = selectWithLastMessage(supabase);
  if (ids) query = query.in("id", ids);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(SEARCH_LIMIT);
  if (error) throw error;
  return sortByActivity(toConversations(data));
}

// 同じ会話が 2 回読まれても、1 つだけ残す
export function mergeConversations(current: Conversation[], incoming: Conversation[]): Conversation[] {
  const byId = new Map(current.map((c) => [c.id, c]));
  for (const c of incoming) byId.set(c.id, c);
  return sortByActivity([...byId.values()]);
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
