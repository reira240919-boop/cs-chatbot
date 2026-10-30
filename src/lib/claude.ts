import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// 要件と提案書で決めたモデル
const MODEL = "claude-sonnet-4-6";

export const CATEGORIES = ["在庫", "配送", "返品", "商品質問", "その他"] as const;

export type Faq = { category: string; question: string; answer: string };

export type ChatTurn = { sender_type: "customer" | "ai" | "operator"; content: string };

const AnswerSchema = z.object({
  reply: z.string().describe("お客様に見せる返事。日本語"),
  escalate: z.boolean().describe("スタッフに引き継ぐなら true"),
  reason: z.string().describe("引き継ぐ理由、または引き継がない理由。スタッフ向けの短いメモ"),
  category: z.enum(CATEGORIES).describe("お問い合わせの分類"),
});

export type Answer = z.infer<typeof AnswerSchema>;

const INSTRUCTIONS = `あなたは、自然派スキンケアのネットショップ「ボタニカ（BOTANICA）」のお問い合わせ窓口の AI アシスタントです。

# 答え方
- 下の「よくある質問」に書いてあることだけを根拠に答えてください。書いていない事実（在庫数、日付、金額、お客様の注文の中身など）は、推測で作らないでください
- 1つのメッセージで複数のことを聞かれたら、よくある質問に書いてあるものは全部まとめて答えてください
- やわらかく丁寧な敬語で、短く答えてください。マークダウンの記号（#、*、表）は使わないでください
- 前のやりとりがあれば、その流れをふまえて答えてください

# スタッフに引き継ぐとき（escalate を true にする）
- ショップやご注文に関する質問で、よくある質問に答えが書いていないとき（例：個別の注文や請求の調査、返金の状況）
- お客様が強く怒っている、責任者を求めている、など気持ちのこもった苦情のとき
- お客様がスタッフとの対応を希望したとき
- 返品・交換・返金・注文の変更など、お客様の手続きをスタッフが進める必要がある申し出のとき（「返品したい」「壊れていた」など）。よくある質問に関係する案内があれば、それも reply に書いてください
- 引き継ぐときの reply には、お詫びや受け止めの言葉と、よくある質問の案内だけを書いてください。「スタッフにおつなぎします」「ご連絡します」「お待ちください」など、引き継ぎや返事の時期の言葉は書かないでください（あとから決まった案内文を付け足します）
- 情報を聞いているだけの質問（「返品はできますか」「送料はいくらですか」など）は、よくある質問で答えられれば引き継がないでください

# ショップと関係のない質問のとき
- 株価、ニュース、ほかの会社のことなど、ショップと関係のない質問には、事実を作らずに「こちらの窓口ではお答えできません」と丁寧にお断りしてください。escalate は false にしてください

# category
- お問い合わせの内容に一番近いものを、在庫・配送・返品・商品質問・その他 から1つ選んでください`;

function buildSystem(faqs: Faq[]): Anthropic.TextBlockParam[] {
  const faqText = faqs.map((f, i) => `${i + 1}. [${f.category}] Q. ${f.question}\nA. ${f.answer}`).join("\n\n");
  // 説明と FAQ は毎回同じなので、まとめてキャッシュして料金と待ち時間を減らす
  return [
    {
      type: "text",
      text: `${INSTRUCTIONS}\n\n# よくある質問\n\n${faqText}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function toMessages(history: ChatTurn[]): Anthropic.MessageParam[] {
  return history.map((turn) =>
    turn.sender_type === "customer"
      ? { role: "user", content: turn.content }
      : { role: "assistant", content: turn.sender_type === "operator" ? `（スタッフ）${turn.content}` : turn.content },
  );
}

// 返事を作る。失敗やお断りのときは null を返し、呼び出し側でスタッフに引き継ぐ
export async function answerCustomer(history: ChatTurn[], faqs: Faq[]): Promise<Answer | null> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
    system: buildSystem(faqs),
    messages: toMessages(history),
  });

  console.log("Claude 利用量", {
    input: response.usage.input_tokens,
    cache_read: response.usage.cache_read_input_tokens,
    cache_write: response.usage.cache_creation_input_tokens,
    output: response.usage.output_tokens,
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return response.parsed_output ?? null;
}
