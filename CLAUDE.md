@AGENTS.md

# このプロジェクトのルール

正にするのは `requirements.md` と `提案書.md`。この 2 つにない機能は足さない。

## 名前の付け方

いまあるファイルと表に合わせる。

- Supabase の表の名前は、英語の複数形で小文字にする（例: `conversations`、`messages`、`faqs`、`operators`）
- 列の名前は、英語の小文字を `_` でつなぐ（例: `customer_session_id`、`sender_type`、`created_at`）
- 表の `id` は `uuid primary key default gen_random_uuid()`。時刻は `created_at timestamptz default now()`
- 状態や種類の値は、英語の小文字を `_` でつなぎ、`check` で決まった値だけにする（例: `ai_handling`、`waiting_operator`、`operator_handling`、`closed`）
- 表を作る SQL は `supabase/migrations/日時_内容.sql` に置く（例: `20261030000000_create_chat_tables.sql`）
- `src/lib/` のファイル名は、つなぐ相手か役わりを小文字と `-` で付ける（例: `claude.ts`、`supabase-admin.ts`、`business-hours.ts`）
- お客様のチャット窓口は `src/widget/`、スタッフ用の画面は `src/app/operator/` に置く
- 関数と変数は camelCase で、動きが分かる名前にする（例: `answerCustomer`、`respondToConversation`、`isBusinessHours`）
- 型は PascalCase の単数形にする（例: `Message`、`Faq`、`Answer`）
- 決まった文言は大文字を `_` でつなぐ（例: `WELCOME_MESSAGE`、`HANDOFF_IN_HOURS`）
- コメント、ログ、お客様とスタッフに見せる文言は日本語で書く

## 配色

ボタニカの仮のブランドカラー。本当の色が届いたら、チャット窓口は `src/widget/theme.ts`、スタッフ用の画面は `src/app/globals.css` の `@theme` だけを差しかえる。

| 使う場所 | 色 |
| --- | --- |
| 背景 | 生成りのベージュ `#F7F3EC`。一覧や会話の面は白 `#FFFFFF` |
| 本文の文字 | `#3F3A34` |
| 小さな文字（時刻・名前） | `#857C72` |
| 重要なボタン（送信・対応する・ログイン） | 1 色だけ使う。くすんだ葉っぱの緑 `#56705A`、文字は白 |
| 取り消しにくい操作（終了にする・ログアウト） | 枠線か文字だけのボタンにし、`#9C5B4E` を使う。塗りつぶさない |
| 枠線・区切り線 | `#E4DCCF` |

- 重要なボタンの緑を、ほかの用途に使い回さない（選んでいるタブの背景は、薄い緑 `#E3EBE3` を使う）
- 終了の前には確認を出す。送信や状態の変更のあとには「送信しました」などを出す
- タブや切り替えは、選んでいるものに背景色を付けて、いまどこにいるか分かるようにする

## 書き方

- 鍵やトークンはコードに書かない。`.env.local` に置き、コードからは `process.env` で読む
- `.env.local` の中身は、画面やログに出さない
- `SUPABASE_SECRET_KEY` を使うのはサーバーだけ（`src/lib/supabase-admin.ts`）。チャット窓口と画面側のコードには入れない
- お客様とスタッフの見られる範囲は、画面で隠すのではなく RLS で守る
