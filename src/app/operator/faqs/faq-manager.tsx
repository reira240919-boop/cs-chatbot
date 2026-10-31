"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { Operator } from "@/lib/supabase-server";
import { OperatorHeader } from "../operator-header";
import {
  createFaq,
  deleteFaq,
  FAQ_CATEGORIES,
  fetchFaqs,
  sortFaqs,
  updateFaq,
  type Faq,
  type FaqCategory,
  type FaqDraft,
} from "./faqs";

const LOAD_ERROR = "よくある質問を読み込めませんでした。ページを開き直してください。";
const SAVE_ERROR = "保存できませんでした。もう一度お試しください。";
const DELETE_ERROR = "消せませんでした。もう一度お試しください。";
const EMPTY_DRAFT: FaqDraft = { category: "在庫", question: "", answer: "" };

type Filter = FaqCategory | "all";
type Notice = { kind: "ok" | "error"; text: string };

export function FaqManager({ operator }: { operator: Operator }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // 開いているフォーム。"new" は追加、それ以外は直している FAQ の id
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = (next: Notice) => {
    setNotice(next);
    setTimeout(() => setNotice((current) => (current === next ? null : current)), 3000);
  };

  useEffect(() => {
    fetchFaqs(supabase)
      .then(setFaqs)
      .catch(() => setNotice({ kind: "error", text: LOAD_ERROR }));
  }, [supabase]);

  const visible = faqs?.filter((faq) => filter === "all" || faq.category === filter) ?? [];
  const count = (category: Filter) => (faqs ?? []).filter((faq) => category === "all" || faq.category === category).length;

  const save = async (draft: FaqDraft) => {
    try {
      const saved = editing === "new" ? await createFaq(supabase, draft) : await updateFaq(supabase, editing!, draft);
      setFaqs((current) => sortFaqs([...(current ?? []).filter((faq) => faq.id !== saved.id), saved]));
      setEditing(null);
      showNotice({ kind: "ok", text: editing === "new" ? "追加しました" : "保存しました" });
      return true;
    } catch {
      showNotice({ kind: "error", text: SAVE_ERROR });
      return false;
    }
  };

  const remove = async (faq: Faq) => {
    if (!window.confirm(`「${faq.question}」を消しますか？\n消すと、AI はこの答えを使わなくなります。`)) return;
    try {
      await deleteFaq(supabase, faq.id);
      setFaqs((current) => current && current.filter((f) => f.id !== faq.id));
      if (editing === faq.id) setEditing(null);
      showNotice({ kind: "ok", text: "消しました" });
    } catch {
      showNotice({ kind: "error", text: DELETE_ERROR });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <OperatorHeader operator={operator} current="/operator/faqs" />

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">よくある質問</h2>
            <p className="mt-1 text-sm text-muted">
              ここにある質問と答えをもとに、AI がお客様に返事をします。保存すると、次のお客様の質問からすぐに使われます。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={editing === "new"}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            ＋ 追加する
          </button>
        </div>

        <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          答えには、確かな事実だけを書いてください。AI は、ここに書かれていないことは答えずに、スタッフへ引き継ぎます。
        </p>

        {editing === "new" && (
          <div className="mt-4">
            <FaqForm title="新しい質問を追加" initial={EMPTY_DRAFT} onSave={save} onCancel={() => setEditing(null)} />
          </div>
        )}

        <div role="tablist" aria-label="分類で絞り込む" className="mt-6 flex gap-1 overflow-x-auto pb-1">
          {(["all", ...FAQ_CATEGORIES] as Filter[]).map((category) => {
            const selected = category === filter;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(category)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-bold ${
                  selected ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface"
                }`}
              >
                {category === "all" ? "すべて" : category}
                <span className="ml-1 text-xs font-normal">{count(category)}</span>
              </button>
            );
          })}
        </div>

        <ul className="mt-3 flex flex-col gap-3">
          {faqs === null && <li className="p-6 text-center text-sm text-muted">読み込んでいます…</li>}
          {faqs !== null && visible.length === 0 && (
            <li className="p-6 text-center text-sm text-muted">この分類の質問はまだありません</li>
          )}
          {visible.map((faq) =>
            editing === faq.id ? (
              <li key={faq.id}>
                <FaqForm title="質問を直す" initial={faq} onSave={save} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={faq.id} className="rounded-xl border border-line bg-surface p-4">
                <span className="rounded bg-canvas px-1.5 py-0.5 text-xs font-bold text-muted">{faq.category}</span>
                <p className="mt-2 font-bold">Q. {faq.question}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">A. {faq.answer}</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(faq.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-bold hover:bg-canvas"
                  >
                    直す
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(faq)}
                    className="rounded-lg border border-danger px-3 py-1.5 text-sm font-bold text-danger"
                  >
                    消す
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      </main>
    </div>
  );
}

type FormProps = {
  title: string;
  initial: FaqDraft;
  onSave: (draft: FaqDraft) => Promise<boolean>;
  onCancel: () => void;
};

function FaqForm({ title, initial, onSave, onCancel }: FormProps) {
  const [category, setCategory] = useState<FaqCategory>(initial.category);
  const [question, setQuestion] = useState(initial.question);
  const [answer, setAnswer] = useState(initial.answer);
  const [saving, setSaving] = useState(false);
  const ready = question.trim() !== "" && answer.trim() !== "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    await onSave({ category, question: question.trim(), answer: answer.trim() });
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="rounded-xl border-2 border-primary-soft bg-surface p-4">
      <p className="font-bold">{title}</p>

      <label className="mt-3 block text-sm font-bold" htmlFor="faq-category">
        分類
      </label>
      <select
        id="faq-category"
        value={category}
        onChange={(event) => setCategory(event.target.value as FaqCategory)}
        className="mt-1 rounded-lg border border-line bg-canvas px-3 py-2"
      >
        {FAQ_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-sm font-bold" htmlFor="faq-question">
        質問（お客様の聞き方）
      </label>
      <input
        id="faq-question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="例：夏に使いやすい化粧水はありますか？"
        className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 outline-primary"
      />

      <label className="mt-3 block text-sm font-bold" htmlFor="faq-answer">
        答え
      </label>
      <textarea
        id="faq-answer"
        rows={4}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="お客様にお伝えする内容を、そのまま書いてください"
        className="mt-1 w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 outline-primary"
      />

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-sm font-bold hover:bg-canvas">
          やめる
        </button>
        <button
          type="submit"
          disabled={!ready || saving}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "保存しています…" : "保存する"}
        </button>
      </div>
    </form>
  );
}
