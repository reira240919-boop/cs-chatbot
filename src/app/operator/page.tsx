import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/lib/supabase-server";
import { OperatorConsole } from "./operator-console";

export default async function OperatorPage() {
  // ログインしていても、スタッフの名簿に載っていなければ入れない
  const operator = await getCurrentOperator();
  if (!operator) redirect("/operator/login");

  return <OperatorConsole operator={operator} />;
}
