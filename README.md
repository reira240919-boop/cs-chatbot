# BOTANICA お問い合わせチャットボット

自然派スキンケアのネットショップ「ボタニカ（BOTANICA）」のお問い合わせ窓口です（架空の案件）。

- お客様：ショップのチャット窓口で質問すると、AI が FAQ をもとに数秒で返事をする
- AI：答えられない質問・クレーム・返品などは、スタッフに引き継ぐ。18 時以降は「翌営業日にご返信」と案内する
- スタッフ：専用の画面で、引き継がれた会話にその場で返信する。FAQ の追加・修正もここで行う

| 読む人 | 資料 |
| --- | --- |
| スタッフ | [スタッフ向けマニュアル](docs/スタッフ向けマニュアル.md) |
| FAQ を直す人 | [FAQ 編集ガイド](docs/FAQ編集ガイド.md) |
| 開発者 | このファイル、[CLAUDE.md](CLAUDE.md)（名前の付け方・色・安全の決まり）、[requirements.md](requirements.md)（範囲） |

## 本番

| | URL |
| --- | --- |
| スタッフ用の画面 | https://cs-chatbot-pi.vercel.app/operator |
| 確認用のショップ（チャット窓口つき） | https://cs-chatbot-pi.vercel.app/demo-shop.html |

### ショップへの埋め込み

ショップに貼るのは次の 1 行だけです。

```html
<script src="https://cs-chatbot-pi.vercel.app/widget.js"></script>
```

Shopify の場合は、管理画面の「オンラインストア → テーマ → コードを編集 → `theme.liquid`」で、`</body>` の直前に貼ります。窓口は Shadow DOM の中に出るので、ショップの見た目とはぶつかりません。AI の API の場所は、`widget.js` を読み込んだ URL から自動で決まります。

※ 開発中は本物の Shopify がないため、確認用のショップ（`public/demo-shop.html`）で確かめています。

## 構成

| 層 | 採用 | 役わり |
| --- | --- | --- |
| チャット窓口 | React（esbuild で `public/widget.js` 1 本にまとめる） | お客様の画面。匿名ログインで、自分の会話だけを読み書きする |
| スタッフ用の画面・API | Next.js 16（App Router）+ Vercel（東京 `hnd1`） | `/operator` の画面と、AI に返事を作らせる `/api/ai-respond` |
| データベース | Supabase（Postgres + RLS、東京） | 会話・メッセージ・FAQ・スタッフの名簿 |
| リアルタイム | Supabase Realtime | 新しいメッセージと状態の変化を、開き直さずに届ける |
| AI | Claude API（`claude-sonnet-4-6`） | FAQ をもとに返事を作り、引き継ぐかどうかと分類を決める |

```
お客様 ─ widget.js ─┬─ Supabase（自分の会話だけ。RLS）
                    └─ POST /api/ai-respond ─ Claude API
                                 └─ Supabase（secret key で返事を書き込む）
スタッフ ─ /operator ─── Supabase（全会話。RLS）
         ← Realtime（新しいメッセージ・状態の変化）→ お客様にも同じく届く
```

## ファイルの役わり

| 場所 | 中身 |
| --- | --- |
| `src/widget/` | お客様のチャット窓口。`chat-widget.tsx`（画面）、`chat.ts`（読み書きと AI の呼び出し）、`theme.ts`（色）、`styles.ts`、`index.tsx`（Shadow DOM に入れる入口） |
| `scripts/build-widget.mjs` | 窓口を `public/widget.js` にまとめる。公開してよい鍵だけを埋め込む |
| `src/app/api/ai-respond/route.ts` | 窓口から呼ばれる API。ログインのトークンで本人の会話かを確かめる（401 / 403） |
| `src/lib/ai-respond.ts` | 返事の流れ。AI 対応中で、最後がお客様のメッセージのときだけ答える。引き継ぐときは状態を `waiting_operator` にする |
| `src/lib/claude.ts` | Claude への指示と呼び出し。答えは決まった形（返事・引き継ぐか・理由・分類）で受け取る |
| `src/lib/business-hours.ts` | 営業時間（日本時間 10〜18 時）の判定 |
| `src/lib/supabase-admin.ts` | secret key を使うサーバー専用の接続。ほかの場所では使わない |
| `src/lib/supabase-browser.ts` / `supabase-server.ts` | スタッフ用の画面からの接続（RLS が効く）。`getCurrentOperator` で名簿に載っているかを確かめる |
| `src/proxy.ts` | `/operator` を開くたびにログインを更新し、ログインしていなければログイン画面へ移す |
| `src/app/operator/` | スタッフ用の画面。`operator-console.tsx`（会話の対応）、`conversations.ts`（会話の読み書き・検索）、`faqs/`（FAQ のページ）、`operator-header.tsx`（上の切りかえ） |
| `supabase/migrations/` | 表・RLS・FAQ の初期データ。日時の順に適用する |
| `scripts/create-operator.mjs` | スタッフのアカウントを作り、名簿に載せる |

## 環境変数

`.env.local` に置きます（Git には入りません）。値はチャットやログに出さないでください。

| 名前 | 使う場所 | 公開してよいか | Vercel に登録 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | すべて | よい | 本番・お試し用 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | すべて（窓口にも埋め込む） | よい（見られる範囲は RLS で守る） | 本番・お試し用 |
| `SUPABASE_SECRET_KEY` | サーバーだけ（`supabase-admin.ts`、スクリプト） | **だめ** | 本番・お試し用（隠す） |
| `ANTHROPIC_API_KEY` | サーバーだけ（`claude.ts`） | **だめ** | 本番・お試し用（隠す） |
| `SUPABASE_DB_PASSWORD` | 手元から `supabase db push` するときだけ | **だめ** | 登録しない |

## 手元で動かす

```bash
npm install
# .env.local を用意する（上の表）
npm run build:widget   # public/widget.js を作る。窓口のコードを変えたら毎回
npm run dev            # http://localhost:3000/demo-shop.html と /operator
npm run lint
npm run build          # build:widget と next build をまとめて行う
```

データベースは本番と共通の 1 つです。手元で試した会話や FAQ は本番にも入るので、試したあとは消してください。

## データベース

| 表 | 中身 |
| --- | --- |
| `operators` | スタッフの名簿。ここに載っている人だけがスタッフ扱い |
| `conversations` | 会話。状態は `ai_handling` → `waiting_operator` → `operator_handling` → `closed`。分類は最初の AI の返事で決まる |
| `messages` | メッセージ。`sender_type` は `customer` / `ai` / `operator` |
| `faqs` | AI が使う FAQ。`embedding` 列は今は使っていない |

表を変えるときは `supabase/migrations/日時_内容.sql` を足して、次で反映します（本番に直接効きます）。

```bash
npx supabase db push --linked --dry-run   # 何が変わるかを先に見る
npx supabase db push --linked
```

### RLS（見られる範囲）のねらい

お客様は匿名ログインですが、Supabase では匿名でも「ログイン済み（authenticated）」になります。そのため、ログインの有無ではなく、名簿（`operators`）に載っているかで見分けます（関数 `is_operator()`）。

| | お客様 | スタッフ | サーバー（secret key） |
| --- | --- | --- | --- |
| 会話・メッセージを見る | 自分の会話だけ（`is_own_conversation()`） | すべて | すべて |
| メッセージを書く | 自分の会話に `customer` としてだけ | 自分の名前で `operator` としてだけ | AI の返事（`ai`） |
| 会話の状態を変える | できない | できる | できる（引き継ぎ） |
| FAQ | 見られない | 見る・足す・直す・消す | 見る |
| スタッフの名簿 | 見られない | 見る | すべて |

ログインしていない人（anon）は、どの表にも触れません。Realtime も RLS に従うので、お客様には自分の会話の通知しか届きません。

### 確かめ方

匿名ログインのお客様 A・B と、スタッフを用意して、次を確かめます（開発中はこの形で試しました）。

1. B の鍵で A の会話・メッセージを読む → 0 件
2. B が A の会話にメッセージを書く → エラー（`42501`）
3. B が A の会話で `/api/ai-respond` を呼ぶ → 403
4. B の鍵で A の会話を Realtime で聞く → 何も届かない
5. お客様の鍵で FAQ・スタッフの名簿を読む → 0 件。FAQ を足す・直す・消す → できない
6. スタッフは A・B 両方の会話を見られる

## Realtime（つながり直し）

- `conversations` と `messages` を Realtime の配信に入れています（最初の migration の最後）。
- チャンネル名には毎回ちがう番号（`crypto.randomUUID()`）を付けます。同じ名前だと、閉じかけの古いチャンネルが使い回されて何も届かなくなるためです（開発中の React の StrictMode で起きました）。
- つながった（`SUBSCRIBED`）直後に、一覧やメッセージを読み直します。つながる前や、切れていた間の分を取りこぼさないためです。つながり直したときも同じ処理が動きます。
- 同じメッセージが Realtime と送信結果の両方から届いても、id で 1 つにまとめます（`mergeMessages` / `mergeConversations`）。

## AI の返事

- FAQ は全件を毎回 system に入れ、キャッシュ（`cache_control`）します。FAQ を直すとキャッシュは作り直されます。FAQ が数百件に増えたら、`embedding` 列を使って近いものだけを渡す形を検討してください。
- 返事は決まった形（`reply` / `escalate` / `reason` / `category`）で受け取ります。返品・交換の申し出、クレーム、FAQ にない質問は引き継ぎます。関係ない質問は、事実を作らずに断ります（引き継がない）。
- Claude の呼び出しに失敗したときは、決まった文を返してスタッフに引き継ぎます。
- 直近 20 件のメッセージを会話の流れとして渡します。

### モデルを変えるときの確かめ方

モデルは `src/lib/claude.ts` の `MODEL` で決めています。変えたら、次の 8 つの会話で、答え方が変わっていないかを確かめてください（`case4-test-conversations.csv`）。

| 番号 | お客様 | 期待する動き |
| --- | --- | --- |
| 1 | 在庫切れの商品はいつ再入荷しますか？ | FAQ どおりに答える（引き継がない） |
| 2 | 送料はいくらですか？ | 同上 |
| 3 | 届いた商品が壊れていました | 謝罪と案内をして、引き継ぐ |
| 4 | 請求金額が二重になっているようなので調べてほしい | 引き継ぐ |
| 5 | 対応が遅すぎる。責任者を出してください | 引き継ぐ |
| 6 | 御社の株価は今いくらですか？ | 作り話をせずに断る |
| 7 | （22:00 に）返品したいのですが | 「翌営業日にご返信」と案内して引き継ぐ |
| 8 | 定期購入の解約方法と、ポイントの有効期限を教えて | 2 つの FAQ をまとめて答える |

1. ブランチを切って `MODEL` を変え、`npm run dev` で起動する
2. 確認用のショップから 1〜6・8 を 1 つずつ送り、AI の返事と、スタッフ用の画面の状態（引き継いだか）・分類を見る
3. 7 は夜を待たずに確かめる：`respondToConversation(会話の id, new Date("2026-10-30T22:00:00+09:00"))` のように、時刻を渡して呼ぶ
4. 新しいモデルで `thinking` や `output_config` の書き方が変わっていないか、Claude API の資料で確かめる
5. 問題がなければ PR を作り、お試し用の URL でもう一度確かめてから main に戻す

## スタッフのアカウント

```bash
node scripts/create-operator.mjs <メールアドレス> <表示名>
```

パスワードは自動で作られ、画面に 1 回だけ出ます。本人に安全な方法で渡してください（どこにも保存されません）。

消すときは、Supabase の管理画面（Authentication → Users）でそのユーザーを消すと、名簿からも消えます。ただし、その人が担当になっている会話が残っていると消せません。先に、その会話の担当を外してください（`conversations.assigned_operator_id` を空にする）。

## 公開（デプロイ）

- Vercel と GitHub をつないでいます。**main に入った時点で、本番に自動で公開されます。**
- main 以外のブランチを push すると、お試し用の URL が自動で作られます（Vercel にログインした人だけが見られます）。
- 進め方：main からブランチを切る → push してお試し用の URL で確かめる → PR を作る → main に戻す。
- コミットの作成者は、GitHub のアカウントにつながったメールアドレスにしてください。つながっていないと、Vercel が公開を止めます。

## 今回やらないこと（次の段階）

[requirements.md](requirements.md) の「やらないこと」を参照してください（週次の集計と感情分析、Shopify の在庫・配送の自動確認、定型文での返信など）。
