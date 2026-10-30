import { supabase } from "./supabase";

export type SenderType = "customer" | "ai" | "operator";
export type ConversationStatus = "ai_handling" | "waiting_operator" | "operator_handling" | "closed";
export type Conversation = { id: string; status: ConversationStatus };

// AI の API は、widget.js を置いたサイトと同じ場所にある（読み込まれた瞬間にしか分からないので、ここで覚えておく）
const API_BASE = new URL((document.currentScript as HTMLScriptElement | null)?.src ?? location.href).origin;

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  content: string;
  created_at: string;
};

// 匿名ログイン。前に来たお客様なら、同じ番号をそのまま使う
export async function ensureCustomer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signedIn.user) throw error ?? new Error("匿名ログインに失敗しました");
  return signedIn.user.id;
}

// 終わっていない会話があれば、その続きから始める
export async function findOpenConversation(customerId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("customer_session_id", customerId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createConversation(customerId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ customer_session_id: customerId })
    .select("id, status")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchConversationStatus(conversationId: string): Promise<ConversationStatus> {
  const { data, error } = await supabase.from("conversations").select("status").eq("id", conversationId).single();
  if (error) throw error;
  return data.status;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendCustomerMessage(conversationId: string, content: string): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_type: "customer", content })
    .select("id, conversation_id, sender_type, content, created_at")
    .single();
  if (error) throw error;
  return data;
}

// AI に返事を頼む。返事そのものは Realtime で届く
export async function requestAiReply(conversationId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("ログインが切れています");
  const response = await fetch(`${API_BASE}/api/ai-respond`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  });
  if (!response.ok) throw new Error(`AI の返事を作れませんでした（${response.status}）`);
}

// 同じメッセージが Realtime と送信結果の両方から届いても、1つだけ残す
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
