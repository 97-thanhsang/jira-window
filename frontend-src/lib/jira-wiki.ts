import type { JiraAttachment } from '@/types/jira';

/**
 * Convert Jira wiki markup to HTML.
 * Handles patterns seen in ASC Jira: bold, italic, headings, code blocks,
 * inline code, images (linked to attachment gallery), links, numbered/bullet lists.
 *
 * @param text    - Raw Jira wiki markup string
 * @param attachments - Optional list of attachments to resolve image filenames → IDs
 */
export function jiraWikiToHtml(text: string, attachments?: JiraAttachment[]): string {
  if (!text) return '';

  // Build filename → attachment ID map for resolving !filename.png! references
  const attachMap = new Map<string, string>();
  attachments?.forEach((a) => attachMap.set(a.filename.toLowerCase(), a.id));

  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headings: h1. h2. h3.
    .replace(
      /^h1\.\s+(.+)$/gm,
      '<h1 class="text-xl font-bold text-[#172B4D] mt-4 mb-2">$1</h1>'
    )
    .replace(
      /^h2\.\s+(.+)$/gm,
      '<h2 class="text-lg font-semibold text-[#172B4D] mt-3 mb-2">$1</h2>'
    )
    .replace(
      /^h3\.\s+(.+)$/gm,
      '<h3 class="text-base font-semibold text-[#172B4D] mt-2 mb-1">$1</h3>'
    )

    // Bold: {*}text{*} and *text*
    .replace(/\{\*\}(.*?)\{\*\}/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')

    // Italic: _text_
    .replace(/_((?!_)[^_\n]+)_/g, '<em>$1</em>')

    // Code blocks: {code:lang}...{code} or {code}...{code}
    .replace(
      /\{code(?::[^}]*)?\}([\s\S]*?)\{code\}/g,
      '<pre class="bg-[#F4F5F7] border border-[#DFE1E6] rounded p-3 my-2 overflow-x-auto text-sm font-mono whitespace-pre-wrap">$1</pre>'
    )

    // Inline code: {{text}}
    .replace(
      /\{\{([^}]+)\}\}/g,
      '<code class="bg-[#F4F5F7] px-1 py-0.5 rounded text-sm font-mono text-[#DE350B]">$1</code>'
    )

    // Links: [text|url]
    .replace(
      /\[([^\]|]+)\|([^\]]+)\]/g,
      '<a href="$2" class="text-[#0052CC] hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    )

    // Numbered lists: lines starting with # or ##
    .replace(/^((?:#+ .+\n?)+)/gm, (match) => {
      const items = match
        .split('\n')
        .filter(Boolean)
        .map((line) => `<li class="ml-4 list-decimal">${line.replace(/^#+ /, '')}</li>`)
        .join('');
      return `<ol class="my-2 space-y-1 list-decimal list-inside">${items}</ol>`;
    })

    // Bullet lists: lines starting with *
    .replace(/^((?:\* .+\n?)+)/gm, (match) => {
      const items = match
        .split('\n')
        .filter(Boolean)
        .map((line) => `<li class="ml-4 list-disc">${line.replace(/^\* /, '')}</li>`)
        .join('');
      return `<ul class="my-2 space-y-1 list-disc list-inside">${items}</ul>`;
    })

    // Paragraph breaks
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br />');

  // Images: !filename.png! or !filename.png|width=300! — resolved via attachment map
  // NOTE: Must be applied AFTER HTML entity escaping & other replacements so the
  // raw filename is still intact. We re-apply it here as a second pass on html.
  html = html.replace(/!([^|!\n]+?)(?:\|([^!]*))?\!/g, (_match, filename: string, _opts: string | undefined) => {
    const id = attachMap.get(filename.toLowerCase());
    if (id) {
      // Render as a clickable chip that triggers the attachment gallery lightbox
      return (
        `<span data-attachment-id="${id}" data-filename="${filename}" ` +
        `class="inline-block border border-[#DFE1E6] rounded p-1 my-1 cursor-pointer ` +
        `text-xs text-[#0052CC] hover:bg-[#DEEBFF] transition-colors select-none">🖼 ${filename}</span>`
      );
    }
    // No matching attachment — show styled placeholder
    return (
      `<span class="inline-block bg-[#F4F5F7] text-[#5E6C84] text-xs px-2 py-1 rounded my-1 ` +
      `border border-[#DFE1E6]">📎 ${filename}</span>`
    );
  });

  return `<div><p class="my-2">${html}</p></div>`;
}
