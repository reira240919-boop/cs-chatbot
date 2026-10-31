import type { SupabaseClient } from "@supabase/supabase-js";

// faqs 表の check と同じ並び
export const FAQ_CATEGORIES = ["在庫", "配送", "返品", "商品質問", "その他"] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  created_at: string;
};

export type FaqDraft = Pick<Faq, "category" | "question" | "answer">;

const FAQ_COLUMNS = "id, category, question, answer, created_at";

// 分類の順、同じ分類の中は登録した順に並べる
export function sortFaqs(faqs: Faq[]): Faq[] {
  return [...faqs].sort(
    (a, b) =>
      FAQ_CATEGORIES.indexOf(a.category) - FAQ_CATEGORIES.indexOf(b.category) ||
      a.created_at.localeCompare(b.created_at),
  );
}

export async function fetchFaqs(supabase: SupabaseClient): Promise<Faq[]> {
  const { data, error } = await supabase.from("faqs").select(FAQ_COLUMNS);
  if (error) throw error;
  return sortFaqs(data as Faq[]);
}

export async function createFaq(supabase: SupabaseClient, draft: FaqDraft): Promise<Faq> {
  const { data, error } = await supabase.from("faqs").insert(draft).select(FAQ_COLUMNS).single();
  if (error) throw error;
  return data as Faq;
}

export async function updateFaq(supabase: SupabaseClient, id: string, draft: FaqDraft): Promise<Faq> {
  const { data, error } = await supabase.from("faqs").update(draft).eq("id", id).select(FAQ_COLUMNS).single();
  if (error) throw error;
  return data as Faq;
}

export async function deleteFaq(supabase: SupabaseClient, id: string): Promise<void> {
  // スタッフでなければ RLS で 0 件になるので、消せたかを件数で確かめる
  const { count, error } = await supabase.from("faqs").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (count !== 1) throw new Error("FAQ を消せませんでした");
}
