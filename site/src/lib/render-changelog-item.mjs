const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}

export function renderChangelogItem(item) {
  return escapeHtml(item)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text font-medium">$1</strong>')
    .replace(
      /`([^`]+)`/g,
      '<code class="px-1 py-0.5 rounded bg-surface-2 text-primary-light text-xs font-mono">$1</code>',
    );
}
