import type { ReactNode } from "react";
import { customerLabel, lastActivity, STATUS_LABELS, timeAgo, type Conversation, type ConversationStatus } from "./conversations";

export type Tab = "waiting" | "handling" | "all";

export const TABS: { id: Tab; label: string; status?: ConversationStatus }[] = [
  { id: "waiting", label: "スタッフ待ち", status: "waiting_operator" },
  { id: "handling", label: "対応中", status: "operator_handling" },
  { id: "all", label: "すべて" },
];

const STATUS_BADGE: Record<ConversationStatus, string> = {
  waiting_operator: "bg-danger-soft text-danger",
  operator_handling: "bg-primary-soft text-primary",
  ai_handling: "bg-canvas text-muted",
  closed: "bg-canvas text-muted",
};

type Props = {
  conversations: Conversation[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
  emptyText?: string;
  footer?: ReactNode;
};

export function ConversationList({
  conversations,
  tab,
  onTabChange,
  selectedId,
  onSelect,
  now,
  emptyText = "該当する会話はありません",
  footer,
}: Props) {
  const status = TABS.find((t) => t.id === tab)?.status;
  const visible = status ? conversations.filter((c) => c.status === status) : conversations;
  const count = (s?: ConversationStatus) => (s ? conversations.filter((c) => c.status === s).length : null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="会話の絞り込み" className="flex gap-1 border-b border-line p-2">
        {TABS.map((t) => {
          const selected = t.id === tab;
          const n = count(t.status);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(t.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-1 py-2 text-sm font-bold ${
                selected ? "bg-primary-soft text-primary" : "text-muted hover:bg-canvas"
              }`}
            >
              {t.label}
              {n !== null && n > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 text-xs ${
                    t.status === "waiting_operator" ? "bg-danger text-white" : "bg-surface text-primary"
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ul className="flex-1 overflow-y-auto">
        {visible.length === 0 && <li className="p-6 text-center text-sm text-muted">{emptyText}</li>}
        {visible.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={c.id === selectedId}
              className={`w-full border-b border-line px-4 py-3 text-left ${
                c.id === selectedId ? "bg-primary-soft" : "hover:bg-canvas"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{customerLabel(c)}</span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(lastActivity(c), now)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${STATUS_BADGE[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
                {c.category && <span className="shrink-0 text-xs text-muted">{c.category}</span>}
              </div>
              <p className="mt-1 truncate text-sm text-muted">{c.last_message?.content ?? "（まだメッセージはありません）"}</p>
            </button>
          </li>
        ))}
        {footer && <li className="p-3 text-center">{footer}</li>}
      </ul>
    </div>
  );
}
