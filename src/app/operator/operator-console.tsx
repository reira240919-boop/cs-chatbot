"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Operator } from "@/lib/supabase-server";
import { ConversationDetail } from "./conversation-detail";
import { ConversationList, type Tab } from "./conversation-list";
import { ConversationSearch } from "./conversation-search";
import {
  CLOSED_PAGE_SIZE,
  closeConversation,
  fetchClosedConversations,
  fetchMessages,
  fetchOpenConversations,
  fetchOperatorNames,
  mergeConversations,
  mergeMessages,
  searchConversations,
  SEARCH_LIMIT,
  sendOperatorReply,
  sortByActivity,
  takeConversation,
  type Conversation,
  type Message,
  type SearchCondition,
} from "./conversations";

const PAGE_TITLE = "ボタニカ お問い合わせ対応";
const LOAD_ERROR = "会話を読み込めませんでした。ページを開き直してください。";
const ACTION_ERROR = "うまくいきませんでした。もう一度お試しください。";
const SEARCH_ERROR = "探せませんでした。もう一度お試しください。";

type Notice = { kind: "ok" | "error"; text: string };

export function OperatorConsole({ operator }: { operator: Operator }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("waiting");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ conversationId: string; messages: Message[] } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [hasMoreClosed, setHasMoreClosed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // 検索中だけ results に結果が入る（null のときは、ふだんの一覧）
  const [search, setSearch] = useState<SearchCondition | null>(null);
  const [results, setResults] = useState<Conversation[] | null>(null);
  const searchId = useRef(0);

  const showNotice = (next: Notice) => {
    setNotice(next);
    setTimeout(() => setNotice((current) => (current === next ? null : current)), 3000);
  };

  // 一覧とスタッフの名前。新しい会話・メッセージ・状態の変化は、開き直さずに受け取る
  useEffect(() => {
    const reload = () =>
      Promise.all([fetchOpenConversations(supabase), fetchClosedConversations(supabase, 0)])
        .then(([open, closed]) => {
          setConversations(mergeConversations([], [...open, ...closed]));
          setHasMoreClosed(closed.length === CLOSED_PAGE_SIZE);
        })
        .catch(() => setNotice({ kind: "error", text: LOAD_ERROR }));
    // 状態や最新のメッセージの変化は、ふだんの一覧と検索の結果の両方に入れる
    const updateLists = (change: (list: Conversation[]) => Conversation[]) => {
      setConversations((current) => current && change(current));
      setResults((current) => current && change(current));
    };
    fetchOperatorNames(supabase).then(setOperatorNames).catch(() => {});

    // 同じ名前だと、閉じかけの古いチャンネルが使い回されて何も届かなくなるので、毎回ちがう名前にする
    const channel = supabase
      .channel(`operator-console-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
        const added = { ...(payload.new as Omit<Conversation, "last_message">), last_message: null };
        setConversations((current) => current && sortByActivity([added, ...current.filter((c) => c.id !== added.id)]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, (payload) => {
        const updated = payload.new as Omit<Conversation, "last_message">;
        updateLists((list) => list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const message = payload.new as Message;
        updateLists((list) =>
          sortByActivity(list.map((c) => (c.id === message.conversation_id ? { ...c, last_message: message } : c))),
        );
        setDetail((current) =>
          current?.conversationId === message.conversation_id
            ? { ...current, messages: mergeMessages(current.messages, [message]) }
            : current,
        );
      })
      .subscribe((status) => {
        // つながった直後に読み直して、つながる前の分の取りこぼしを防ぐ
        if (status === "SUBSCRIBED") reload();
      });

    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [supabase]);

  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(supabase, selectedId)
      .then((messages) => setDetail({ conversationId: selectedId, messages }))
      .catch(() => showNotice({ kind: "error", text: LOAD_ERROR }));
  }, [supabase, selectedId]);

  // スタッフ待ちがあれば、ブラウザのタブの題名でも分かるようにする
  const waitingCount = conversations?.filter((c) => c.status === "waiting_operator").length ?? 0;
  useEffect(() => {
    document.title = waitingCount > 0 ? `(${waitingCount}) スタッフ待ち｜${PAGE_TITLE}` : PAGE_TITLE;
  }, [waitingCount]);

  const shown = search ? results : conversations;
  const selected = shown?.find((c) => c.id === selectedId) ?? conversations?.find((c) => c.id === selectedId) ?? null;
  const selectedMessages = detail?.conversationId === selectedId ? detail.messages : null;

  const runSearch = async (condition: SearchCondition) => {
    // 前の検索の結果が、あとから届いて上書きしないようにする
    const id = ++searchId.current;
    setSearch(condition);
    setResults(null);
    setTab("all");
    try {
      const found = await searchConversations(supabase, condition);
      if (id === searchId.current) setResults(found);
    } catch {
      if (id !== searchId.current) return;
      setSearch(null);
      showNotice({ kind: "error", text: SEARCH_ERROR });
    }
  };

  const clearSearch = () => {
    searchId.current++;
    setSearch(null);
    setResults(null);
  };

  const loadMoreClosed = async () => {
    if (!conversations) return;
    setLoadingMore(true);
    try {
      const offset = conversations.filter((c) => c.status === "closed").length;
      const more = await fetchClosedConversations(supabase, offset);
      setConversations((current) => current && mergeConversations(current, more));
      setHasMoreClosed(more.length === CLOSED_PAGE_SIZE);
    } catch {
      showNotice({ kind: "error", text: LOAD_ERROR });
    } finally {
      setLoadingMore(false);
    }
  };

  const searchLabel = search && [search.keyword && `「${search.keyword}」を含む`, search.category && `分類が「${search.category}」の`]
    .filter(Boolean)
    .join("・");

  const runAction = async (action: () => Promise<void>, okText: string) => {
    setBusy(true);
    try {
      await action();
      showNotice({ kind: "ok", text: okText });
    } catch {
      showNotice({ kind: "error", text: ACTION_ERROR });
    } finally {
      setBusy(false);
    }
  };

  const take = () => {
    if (!selected) return;
    runAction(() => takeConversation(supabase, selected.id, operator.id), "あなたの担当にしました");
  };

  const close = () => {
    if (!selected || !window.confirm("この会話を終了にしますか？\n終了にすると、返信できなくなります。")) return;
    runAction(() => closeConversation(supabase, selected.id), "終了にしました");
  };

  const send = async (content: string) => {
    if (!selected) return false;
    try {
      // 返信したら自分の担当にする（AI はもう返事をしない）
      if (selected.status !== "operator_handling") await takeConversation(supabase, selected.id, operator.id);
      const sent = await sendOperatorReply(supabase, selected.id, operator.id, content);
      setDetail((current) =>
        current?.conversationId === selected.id ? { ...current, messages: mergeMessages(current.messages, [sent]) } : current,
      );
      showNotice({ kind: "ok", text: "送信しました" });
      return true;
    } catch {
      showNotice({ kind: "error", text: "送信できませんでした。もう一度お試しください。" });
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/operator/login");
    router.refresh();
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <h1 className="truncate text-sm font-bold sm:text-base">{PAGE_TITLE}</h1>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">{operator.displayName} さん</span>
          <button
            type="button"
            onClick={logout}
            className="whitespace-nowrap rounded-lg border border-danger px-3 py-1.5 font-bold text-danger"
          >
            ログアウト
          </button>
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className={`fixed left-1/2 top-16 z-10 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-bold shadow ${
            notice.kind === "ok" ? "bg-primary text-white" : "border border-danger bg-surface text-danger"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          className={`w-full shrink-0 flex-col border-r border-line bg-surface md:flex md:w-80 ${selected ? "hidden" : "flex"}`}
        >
          <ConversationSearch onSearch={runSearch} onClear={clearSearch} active={search !== null} />
          {search && (
            <p role="status" className="border-b border-line bg-canvas px-3 py-1.5 text-xs text-muted">
              {results === null
                ? "探しています…"
                : `${searchLabel}会話 ${results.length}件${results.length === SEARCH_LIMIT ? "（多いため、新しい100件まで）" : ""}`}
            </p>
          )}
          {shown === null ? (
            <p className="p-6 text-center text-sm text-muted">{search ? "探しています…" : "読み込んでいます…"}</p>
          ) : (
            <ConversationList
              conversations={shown}
              tab={tab}
              onTabChange={setTab}
              selectedId={selectedId}
              onSelect={setSelectedId}
              now={now}
              emptyText={search ? "見つかりませんでした" : undefined}
              footer={
                !search && tab === "all" && hasMoreClosed ? (
                  <button
                    type="button"
                    onClick={loadMoreClosed}
                    disabled={loadingMore}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-bold hover:bg-canvas disabled:opacity-50"
                  >
                    {loadingMore ? "読み込んでいます…" : "終了した会話をもっと見る"}
                  </button>
                ) : undefined
              }
            />
          )}
        </aside>

        <main className={`min-w-0 flex-1 md:block ${selected ? "block" : "hidden"}`}>
          {selected ? (
            <ConversationDetail
              key={selected.id}
              conversation={selected}
              messages={selectedMessages}
              operatorNames={operatorNames}
              onTake={take}
              onClose={close}
              onSend={send}
              onBack={() => setSelectedId(null)}
              busy={busy}
            />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-sm text-muted">左の一覧から会話を選んでください</p>
          )}
        </main>
      </div>
    </div>
  );
}
