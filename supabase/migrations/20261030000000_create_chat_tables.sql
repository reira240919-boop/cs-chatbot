-- 段階1: 会話・メッセージ・FAQ・スタッフの表と、見られる人のルール（RLS）

-- FAQ の検索用（embedding）に使う
create extension if not exists vector with schema extensions;

-- スタッフ（オペレーター）。ここに載っている人だけが全会話を見られる
-- お客様は匿名ログインでも「ログイン済み」扱いになるため、ログインの有無ではなくこの表で見分ける
create table operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

-- 会話セッション
create table conversations (
  id uuid primary key default gen_random_uuid(),
  -- 匿名ログインしたお客様の auth.uid() を入れる（お客様が自分で名乗る値は使わない）
  customer_session_id text not null,
  status text not null default 'ai_handling'
    check (status in ('ai_handling', 'waiting_operator', 'operator_handling', 'closed')),
  assigned_operator_id uuid references auth.users(id),
  category text check (category in ('在庫', '配送', '返品', '商品質問', 'その他')),
  created_at timestamptz default now()
);

create index conversations_status_created_at_idx on conversations (status, created_at desc);
create index conversations_customer_session_id_idx on conversations (customer_session_id);

-- メッセージ
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'ai', 'operator')),
  sender_id uuid, -- operator の場合のみ
  content text not null,
  created_at timestamptz default now()
);

create index messages_conversation_id_created_at_idx on messages (conversation_id, created_at);

-- FAQ ナレッジ（AI が参照）
create table faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('在庫', '配送', '返品', '商品質問', 'その他')),
  question text not null,
  answer text not null,
  embedding extensions.vector(1536), -- 検索用
  created_at timestamptz default now()
);

-- いまログインしている人がスタッフかどうか
create function is_operator() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.operators where user_id = auth.uid());
$$;

-- 自分の会話かどうか（お客様用）
create function is_own_conversation(target_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations
    where id = target_id and customer_session_id = auth.uid()::text
  );
$$;

alter table operators enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table faqs enable row level security;

-- ログインしていない人（anon）には何も見せない。お客様は匿名ログイン後に authenticated になる
revoke all on operators, conversations, messages, faqs from anon;
grant select on operators, faqs to authenticated;
grant select, insert, update on conversations to authenticated;
grant select, insert on messages to authenticated;

-- operators: スタッフ同士は見られる
create policy "operator_read_operators" on operators
  for select to authenticated using (is_operator());

-- conversations: お客様は自分の会話だけ、スタッフは全会話
create policy "customer_own_conversation" on conversations
  for select to authenticated using (customer_session_id = auth.uid()::text);

create policy "operator_all_conversations" on conversations
  for select to authenticated using (is_operator());

-- お客様は自分の会話を始められる。状態や担当は最初の値のまま
create policy "customer_create_conversation" on conversations
  for insert to authenticated with check (
    customer_session_id = auth.uid()::text
    and status = 'ai_handling'
    and assigned_operator_id is null
  );

-- 状態や担当を変えられるのはスタッフだけ（AI からの切り替えはサーバーが secret key で行う）
create policy "operator_update_conversation" on conversations
  for update to authenticated using (is_operator()) with check (is_operator());

-- messages: お客様は自分の会話のメッセージだけ、スタッフは全部
create policy "customer_own_messages" on messages
  for select to authenticated using (is_own_conversation(conversation_id));

create policy "operator_all_messages" on messages
  for select to authenticated using (is_operator());

-- お客様は自分の会話に、お客様として書ける
create policy "customer_send_message" on messages
  for insert to authenticated with check (
    sender_type = 'customer'
    and sender_id is null
    and is_own_conversation(conversation_id)
  );

-- スタッフは自分の名前でだけ書ける
create policy "operator_send_message" on messages
  for insert to authenticated with check (
    sender_type = 'operator'
    and sender_id = auth.uid()
    and is_operator()
  );

-- faqs: 画面から見るのはスタッフだけ（AI はサーバーが secret key で読む）
create policy "operator_read_faqs" on faqs
  for select to authenticated using (is_operator());

-- 画面を開き直さずに新しいメッセージと状態の変化を受け取る（Realtime）
alter publication supabase_realtime add table conversations, messages;
