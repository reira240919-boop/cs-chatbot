import { supabase } from "./supabase";

export type SenderType = "customer" | "ai" | "operator";

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
export async function findOpenConversation(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_session_id", customerId)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createConversation(customerId: string): Promise<string> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ customer_session_id: customerId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
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

// 同じメッセージが Realtime と送信結果の両方から届いても、1つだけ残す
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
