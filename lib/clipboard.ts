export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  let ta: HTMLTextAreaElement | null = null;
  try {
    ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard copy command was rejected");
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  } finally {
    ta?.remove();
  }
}
