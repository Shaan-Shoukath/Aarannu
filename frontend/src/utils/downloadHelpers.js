/** Trigger a browser download for any Blob. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build a safe filename from a member name + index. */
export function safeFileName(name, index, ext = "pdf") {
  const safe = (name || "unnamed")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${String(index + 1).padStart(5, "0")}_${safe}.${ext}`;
}
