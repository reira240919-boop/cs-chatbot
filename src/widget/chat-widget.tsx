import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "./supabase";
import {
  createConversation,
  ensureCustomer,
  fetchConversationStatus,
  fetchMessages,
  findOpenConversation,
  mergeMessages,
  requestAiReply,
  sendCustomerMessage,
  type ConversationStatus,
  type Message,
  type SenderType,
} from "./chat";

const WELCOME_MESSAGE = "こんにちは。ボタニカです。\n在庫・配送・返品・商品について、お気軽にご質問ください。";
const CONNECT_ERROR = "接続できませんでした。時間をおいて、もう一度開いてください。";
const SEND_ERROR = "送信できませんでした。もう一度お試しください。";
const AI_ERROR = "自動の返事を受け取れませんでした。少し待ってから、もう一度お送りください。";

// 会話の状態ごとに、お客様へ出す案内（AI が対応している間は出さない）
const STATUS_NOTICES: Partial<Record<ConversationStatus, string>> = {
  waiting_operator: "スタッフにおつなぎしています。返信はこの画面に届きます。",
  operator_handling: "スタッフが対応しています。",
  closed: "この会話は終了しました。メッセージを送ると、新しいお問い合わせになります。",
};

const SENDER_LABELS: Record<SenderType, string> = {
  customer: "あなた",
  ai: "AI アシスタント",
  operator: "スタッフ",
};

type ConnectionState = "idle" | "connecting" | "ready" | "error";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConversationStatus | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初めて開いたときだけ匿名ログインする（見ているだけのお客様の分は作らない）
  const connect = useCallback(async () => {
    setConnection("connecting");
    try {
      const id = await ensureCustomer();
      const openConversation = await findOpenConversation(id);
      if (openConversation) setMessages(await fetchMessages(openConversation.id));
      setCustomerId(id);
      setConversationId(openConversation?.id ?? null);
      setStatus(openConversation?.status ?? null);
      setConnection("ready");
    } catch {
      setConnection("error");
    }
  }, []);

  const toggle = () => {
    if (!open && connection === "idle") connect();
    setOpen(!open);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, connection]);

  // AI やスタッフの返事と、スタッフへの引き継ぎを、画面を開き直さずに受け取る
  useEffect(() => {
    if (!conversationId) return;
    // 同じ名前だと、閉じかけの古いチャンネルが使い回されて何も届かなくなるので、毎回ちがう名前にする
    const channel = supabase
      .channel(`conv-${conversationId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((current) => mergeMessages(current, [payload.new as Message])),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => setStatus((payload.new as { status: ConversationStatus }).status),
      )
      .subscribe(async (state) => {
        // つながる前に届いた分の取りこぼしを防ぐ
        if (state === "SUBSCRIBED") {
          const latest = await fetchMessages(conversationId).catch(() => []);
          setMessages((current) => mergeMessages(current, latest));
          fetchConversationStatus(conversationId).then(setStatus).catch(() => {});
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // 返事を待つ間は「入力中」を出す。返事そのものは Realtime で届く
  const askAi = async (id: string) => {
    setAiThinking(true);
    setAiError(false);
    try {
      await requestAiReply(id);
    } catch {
      setAiError(true);
    } finally {
      setAiThinking(false);
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending || aiThinking || !customerId) return;
    setSending(true);
    setSendError(null);
    setInput("");
    try {
      // 会話は、最初のメッセージを送ったときに作る。終了した会話のあとは、新しい会話にする
      let id = conversationId;
      let currentStatus = status;
      if (!id || currentStatus === "closed") {
        const created = await createConversation(customerId);
        id = created.id;
        currentStatus = created.status;
        setConversationId(id);
        setStatus(currentStatus);
        setMessages([]);
      }
      const sent = await sendCustomerMessage(id, content);
      setMessages((current) => mergeMessages(current, [sent]));
      // スタッフに引き継いだあとは、AI は呼ばない（スタッフが返事をする）
      if (currentStatus === "ai_handling") askAi(id);
    } catch {
      setInput(content);
      setSendError(SEND_ERROR);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語の変換を確定する Enter では送らない。Shift+Enter は改行
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <>
      {open && (
        <section className="panel" role="dialog" aria-label="ボタニカ お問い合わせチャット">
          <header className="header">
            <div>
              <p className="title">ボタニカ お問い合わせ</p>
              <p className="subtitle">AI がお答えします。必要なときはスタッフにおつなぎします</p>
            </div>
            <button type="button" className="close" onClick={() => setOpen(false)} aria-label="チャットを閉じる">
              ×
            </button>
          </header>

          <div className="messages" ref={listRef} aria-live="polite">
            <Bubble sender="ai" content={WELCOME_MESSAGE} />
            {messages.map((m) => (
              <Bubble key={m.id} sender={m.sender_type} content={m.content} />
            ))}
            {aiThinking && (
              <div className="row ai">
                <p className="sender">{SENDER_LABELS.ai}</p>
                <p className="bubble typing" role="status" aria-label="返事を考えています">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            )}
            {aiError && <p className="notice error">{AI_ERROR}</p>}
            {status && STATUS_NOTICES[status] && <p className="notice status">{STATUS_NOTICES[status]}</p>}
            {connection === "connecting" && <p className="notice">接続しています…</p>}
            {connection === "error" && (
              <p className="notice error">
                {CONNECT_ERROR}
                <button type="button" className="retry" onClick={connect}>
                  もう一度つなぐ
                </button>
              </p>
            )}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            {sendError && <p className="send-error">{sendError}</p>}
            <div className="composer-row">
              <textarea
                ref={inputRef}
                className="input"
                rows={1}
                value={input}
                placeholder="メッセージを入力"
                aria-label="メッセージ"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                disabled={connection !== "ready"}
              />
              <button
                type="submit"
                className="send"
                disabled={connection !== "ready" || sending || aiThinking || !input.trim()}
              >
                {sending ? "送信中" : "送信"}
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        className="launcher"
        onClick={toggle}
        aria-label={open ? "チャットを閉じる" : "チャットで問い合わせる"}
        aria-expanded={open}
      >
        {open ? (
          <span className="launcher-close">×</span>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4.5 3.6A.6.6 0 0 1 3.5 21v-3A2 2 0 0 1 2 16V6a2 2 0 0 1 2-2Z"
            />
          </svg>
        )}
      </button>
    </>
  );
}

function Bubble({ sender, content }: { sender: SenderType; content: string }) {
  return (
    <div className={`row ${sender}`}>
      {sender !== "customer" && <p className="sender">{SENDER_LABELS[sender]}</p>}
      <p className="bubble">{content}</p>
    </div>
  );
}
