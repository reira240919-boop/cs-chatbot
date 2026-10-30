import { createRoot } from "react-dom/client";
import { ChatWidget } from "./chat-widget";
import { buildStyles } from "./styles";
import { THEME } from "./theme";

const HOST_ID = "botanica-chat";

// ショップの <script> 1 行から呼ばれる入口。ショップの見た目とぶつからないよう Shadow DOM に入れる
function mount() {
  if (document.getElementById(HOST_ID)) return; // 2 回読み込まれても 1 つだけ出す

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = buildStyles(THEME);
  const container = document.createElement("div");
  shadow.append(style, container);

  createRoot(container).render(<ChatWidget />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
