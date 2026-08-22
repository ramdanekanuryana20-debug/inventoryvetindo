export function rupiah(n) {
  const num = Number(n) || 0;
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

export function num(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return "-";
  try {
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}
