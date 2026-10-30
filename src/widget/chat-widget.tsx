import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "./supabase";
import {
  createConversation,
  ensureCustomer,
  fetchMessages,
  findOpenConversation,
  mergeMessages,
  sendCustomerMessage,
  type Message,
  type SenderType,
} from "./chat";

const WELCOME_MESSAGE = "こんにちは。ボタニカです。\n在庫・配送・返品・商品について、お気軽にご質問ください。";
const CONNECT_ERROR = "接続できませんでした。時間をおいて、もう一度開いてください。";
const SEND_ERROR = "送信できませんでした。もう一度お試しください。";

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
      const openId = await findOpenConversation(id);
      if (openId) setMessages(await fetchMessages(openId));
      setCustomerId(id);
      setConversationId(openId);
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

  // AI やスタッフの返事を、画面を開き直さずに受け取る
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((current) => mergeMessages(current, [payload.new as Message])),
      )
      .subscribe(async (status) => {
        // つながる前に届いた分の取りこぼしを防ぐ
        if (status === "SUBSCRIBED") {
          const latest = await fetchMessages(conversationId).catch(() => []);
          setMessages((current) => mergeMessages(current, latest));
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending || !customerId) return;
    setSending(true);
    setSendError(null);
    setInput("");
    try {
      // 会話は、最初のメッセージを送ったときに作る
      const id = conversationId ?? (await createConversation(customerId));
      if (!conversationId) setConversationId(id);
      const sent = await sendCustomerMessage(id, content);
      setMessages((current) => mergeMessages(current, [sent]));
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
                disabled={connection !== "ready" || sending || !input.trim()}
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
