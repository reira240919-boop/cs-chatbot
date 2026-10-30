import type { Theme } from "./theme";

// ショップ側の見た目とぶつからないよう、Shadow DOM の中だけに効かせる
export function buildStyles(t: Theme): string {
  return `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; }
.launcher, .panel {
  font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: ${t.text};
}
.launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background: ${t.primary}; color: ${t.primaryText};
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease;
}
.launcher:hover { transform: scale(1.05); }
.launcher:focus-visible, button:focus-visible, .input:focus-visible { outline: 2px solid ${t.primary}; outline-offset: 2px; }
.launcher-close { font-size: 26px; line-height: 1; }
.panel {
  position: fixed; right: 20px; bottom: 88px; z-index: 2147483000;
  width: 360px; height: min(560px, calc(100vh - 120px));
  display: flex; flex-direction: column; overflow: hidden;
  background: ${t.background}; border: 1px solid ${t.border}; border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
  animation: rise 0.2s ease-out;
}
.header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  padding: 14px 16px; background: ${t.primary}; color: ${t.primaryText};
}
.title { font-weight: 700; font-size: 15px; }
.subtitle { font-size: 12px; opacity: 0.9; }
.close {
  border: none; background: transparent; color: ${t.primaryText};
  font-size: 22px; line-height: 1; cursor: pointer; padding: 2px 4px;
}
.messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; flex-direction: column; max-width: 85%; animation: rise 0.25s ease-out; }
.row.customer { align-self: flex-end; align-items: flex-end; }
.row.ai, .row.operator { align-self: flex-start; }
.sender { font-size: 11px; color: ${t.muted}; margin: 0 0 2px 4px; }
.bubble { padding: 9px 13px; border-radius: 14px; white-space: pre-wrap; word-break: break-word; }
.row.customer .bubble { background: ${t.primary}; color: ${t.primaryText}; border-bottom-right-radius: 4px; }
.row.ai .bubble, .row.operator .bubble { background: ${t.surface}; border: 1px solid ${t.border}; border-bottom-left-radius: 4px; }
.row.operator .sender { color: ${t.primary}; font-weight: 700; }
.notice { font-size: 12px; color: ${t.muted}; text-align: center; }
.notice.error, .send-error { color: ${t.error}; }
.retry {
  display: block; margin: 6px auto 0; padding: 4px 12px; cursor: pointer;
  border: 1px solid ${t.error}; border-radius: 999px; background: transparent; color: ${t.error}; font-size: 12px;
}
.composer { padding: 10px 12px 12px; border-top: 1px solid ${t.border}; background: ${t.surface}; }
.send-error { font-size: 12px; margin-bottom: 6px; }
.composer-row { display: flex; gap: 8px; align-items: flex-end; }
.input {
  flex: 1; resize: none; max-height: 96px; padding: 8px 12px;
  font: inherit; color: ${t.text}; background: ${t.background};
  border: 1px solid ${t.border}; border-radius: 12px;
}
.input:disabled { opacity: 0.6; }
.send {
  padding: 8px 16px; border: none; border-radius: 12px; cursor: pointer; font: inherit; font-weight: 700;
  background: ${t.primary}; color: ${t.primaryText}; white-space: nowrap;
}
.send:disabled { opacity: 0.45; cursor: default; }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .panel, .row { animation: none; } }
@media (max-width: 480px) {
  .panel { right: 0; bottom: 0; width: 100vw; height: 100dvh; border-radius: 0; border: none; }
  .launcher { right: 16px; bottom: 16px; }
  .panel ~ .launcher { display: none; }
}
`;
}
