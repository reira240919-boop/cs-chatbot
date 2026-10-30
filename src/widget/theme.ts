// ブランドカラー（仮）。ボタニカ様から色の指定が届いたら、ここだけ差しかえる
export const THEME = {
  primary: "#56705A", // くすんだ葉っぱの緑。開くボタン・送信ボタン・お客様の吹き出し
  primaryText: "#FFFFFF", // 緑の上の文字
  background: "#F7F3EC", // 生成りのベージュ。会話の背景
  surface: "#FFFFFF", // AI・スタッフの吹き出し、入力欄
  text: "#3F3A34", // 本文
  muted: "#857C72", // 名前・時刻などの小さな文字
  border: "#E4DCCF", // 枠線
  error: "#9C5B4E", // 送れなかったときの文字
};

export type Theme = typeof THEME;
