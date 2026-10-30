// スタッフのアカウントを作り、スタッフの名簿（operators）に載せる。登録の画面は作らない
// 使い方: node scripts/create-operator.mjs <メールアドレス> <表示名>
// パスワードは自動で作り、画面に 1 回だけ出す（どこにも保存しない）
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const [email, displayName] = process.argv.slice(2);
if (!email || !displayName) {
  console.error("使い方: node scripts/create-operator.mjs <メールアドレス> <表示名>");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const password = randomBytes(12).toString("base64url");
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("アカウントを作れませんでした:", error.message);
  process.exit(1);
}

const { error: operatorError } = await admin.from("operators").insert({ user_id: data.user.id, display_name: displayName });
if (operatorError) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error("スタッフの名簿に載せられませんでした:", operatorError.message);
  process.exit(1);
}

console.log(`スタッフ「${displayName}」を作りました`);
console.log(`メールアドレス: ${email}`);
console.log(`パスワード: ${password}`);
