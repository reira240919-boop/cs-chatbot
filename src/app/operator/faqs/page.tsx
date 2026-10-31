import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/lib/supabase-server";
import { FaqManager } from "./faq-manager";

export const metadata = { title: "よくある質問｜ボタニカ お問い合わせ対応" };

export default async function FaqsPage() {
  // ログインしていても、スタッフの名簿に載っていなければ入れない
  const operator = await getCurrentOperator();
  if (!operator) redirect("/operator/login");

  return <FaqManager operator={operator} />;
}
