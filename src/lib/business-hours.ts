// 営業時間は 10〜18 時（日本時間）。サーバーの置き場所の時刻に左右されないよう、日本時間に直して判定する
const OPEN_HOUR = 10;
const CLOSE_HOUR = 18;

export function isBusinessHours(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(now),
  );
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}
