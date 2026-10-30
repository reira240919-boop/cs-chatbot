import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { customerLabel, STATUS_LABELS, type Conversation, type Message } from "./conversations";

type Props = {
  conversation: Conversation;
  messages: Message[] | null;
  operatorNames: Record<string, string>;
  onTake: () => void;
  onClose: () => void;
  onSend: (content: string) => Promise<boolean>;
  onBack: () => void;
  busy: boolean;
};

export function ConversationDetail({ conversation, messages, operatorNames, onTake, onClose, onSend, onBack, busy }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const closed = conversation.status === "closed";
  const canTake = conversation.status === "ai_handling" || conversation.status === "waiting_operator";
  const assignee = conversation.assigned_operator_id ? operatorNames[conversation.assigned_operator_id] : null;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    const ok = await onSend(content);
    if (ok) setInput("");
    setSending(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 日本語の変換を確定する Enter では送らない。Shift+Enter は改行
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-3">
        <button type="button" onClick={onBack} className="text-sm font-bold text-primary md:hidden">
          ← 一覧
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{customerLabel(conversation)}</p>
          <p className="text-xs text-muted">
            {STATUS_LABELS[conversation.status]}
            {conversation.category && `・${conversation.category}`}
            {assignee && `・担当 ${assignee}`}
          </p>
        </div>
        {canTake && (
          <button
            type="button"
            onClick={onTake}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            対応する
          </button>
        )}
        {!closed && (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-danger px-4 py-2 text-sm font-bold text-danger disabled:opacity-50"
          >
            終了にする
          </button>
        )}
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages === null && <p className="text-center text-sm text-muted">読み込んでいます…</p>}
        {messages?.map((m) => (
          <div key={m.id} className={`flex max-w-[80%] flex-col ${m.sender_type === "customer" ? "self-start" : "items-end self-end"}`}>
            <p className="mb-0.5 text-xs text-muted">
              {m.sender_type === "customer" && "お客様"}
              {m.sender_type === "ai" && "AI"}
              {m.sender_type === "operator" && `スタッフ（${(m.sender_id && operatorNames[m.sender_id]) || "スタッフ"}）`}
              ・{new Date(m.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p
              className={`whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2 ${
                m.sender_type === "customer"
                  ? "border-line bg-surface"
                  : m.sender_type === "ai"
                    ? "border-line bg-canvas"
                    : "border-primary-soft bg-primary-soft"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
      </div>

      {closed ? (
        <p className="border-t border-line bg-surface p-4 text-center text-sm text-muted">この会話は終了しています</p>
      ) : (
        <form
          className="border-t border-line bg-surface p-3"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="お客様への返信を入力（Enter で送信、Shift+Enter で改行）"
              aria-label="お客様への返信"
              className="flex-1 resize-none rounded-lg border border-line bg-canvas px-3 py-2 outline-primary"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-lg bg-primary px-5 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {sending ? "送信中" : "送信"}
            </button>
          </div>
          {canTake && <p className="mt-1.5 text-xs text-muted">送信すると、この会話はあなたの担当になり、AI は返事をしなくなります</p>}
        </form>
      )}
    </div>
  );
}
