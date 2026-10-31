import { useState, type FormEvent } from "react";
import { CATEGORIES, type SearchCondition } from "./conversations";

type Props = {
  onSearch: (condition: SearchCondition) => void;
  onClear: () => void;
  active: boolean;
};

// 会話一覧の上の検索欄。言葉は Enter か「探す」で、分類は選んだときに探す
export function ConversationSearch({ onSearch, onClear, active }: Props) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");

  const search = (next: SearchCondition) => {
    const condition = { keyword: next.keyword.trim(), category: next.category };
    if (condition.keyword || condition.category) onSearch(condition);
    else onClear();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    search({ keyword, category });
  };

  const clear = () => {
    setKeyword("");
    setCategory("");
    onClear();
  };

  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-2 border-b border-line p-2">
      <div className="flex gap-1.5">
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="言葉で探す（例：割れ）"
          aria-label="会話を言葉で探す"
          className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm outline-primary"
        />
        <button type="submit" className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-bold hover:bg-canvas">
          探す
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            search({ keyword, category: event.target.value });
          }}
          aria-label="分類で絞り込む"
          className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm"
        >
          <option value="">すべての分類</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {active && (
          <button type="button" onClick={clear} className="shrink-0 px-2 py-1.5 text-sm font-bold text-primary">
            検索をやめる
          </button>
        )}
      </div>
    </form>
  );
}
