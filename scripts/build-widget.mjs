// お客様のチャット窓口を public/widget.js の 1 ファイルにまとめる（IIFE）
import { build } from "esbuild";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const PUBLIC_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const missing = PUBLIC_KEYS.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`widget.js を作れません。.env.local に ${missing.join("、")} がありません`);
  process.exit(1);
}

await build({
  entryPoints: ["src/widget/index.tsx"],
  outfile: "public/widget.js",
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2019",
  jsx: "automatic",
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    // 窓口に入れるのは画面に出してよい値だけ
    ...Object.fromEntries(PUBLIC_KEYS.map((key) => [`process.env.${key}`, JSON.stringify(process.env[key])])),
  },
});

console.log("public/widget.js を作りました");
