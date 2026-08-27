import { describe, expect, it } from 'vitest';
import type { JiraAttachment } from '@/types/jira';
import { jiraWikiToHtml } from './jira-wiki';

const attachment = (id: string, filename: string) =>
  ({ id, filename } as JiraAttachment);

describe('jiraWikiToHtml', () => {
  it('returns an empty string for empty input', () => {
    expect(jiraWikiToHtml('')).toBe('');
  });

  it('wraps plain text in the standard container', () => {
    expect(jiraWikiToHtml('hello')).toBe('<div><p class="my-2">hello</p></div>');
  });

  it('escapes HTML so raw markup cannot be injected', () => {
    const html = jiraWikiToHtml('<script>alert("x")</script> a & b');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it.each([
    ['h1. Title', '<h1'],
    ['h2. Title', '<h2'],
    ['h3. Title', '<h3'],
  ])('converts %s to a heading', (input, tag) => {
    const html = jiraWikiToHtml(input);

    expect(html).toContain(`${tag} class=`);
    expect(html).toContain('Title</h');
  });

  it('does not treat h4 as a heading', () => {
    expect(jiraWikiToHtml('h4. Title')).toContain('h4. Title');
  });

  it.each([
    ['*bold*', '<strong>bold</strong>'],
    ['{*}bold{*}', '<strong>bold</strong>'],
    ['_italic_', '<em>italic</em>'],
  ])('converts %s to %s', (input, expected) => {
    expect(jiraWikiToHtml(input)).toContain(expected);
  });

  it('renders inline code with {{...}}', () => {
    const html = jiraWikiToHtml('call {{doThing()}} now');

    expect(html).toContain('<code');
    expect(html).toContain('doThing()</code>');
  });

  it('renders fenced code blocks, with and without a language', () => {
    const withLang = jiraWikiToHtml('{code:java}int x = 1;{code}');
    const withoutLang = jiraWikiToHtml('{code}int x = 1;{code}');

    for (const html of [withLang, withoutLang]) {
      expect(html).toContain('<pre');
      expect(html).toContain('int x = 1;</pre>');
    }
    expect(withLang).not.toContain('java');
  });

  it('preserves newlines inside a code block as <br /> is not applied to them', () => {
    const html = jiraWikiToHtml('{code}line1\nline2{code}');

    expect(html).toContain('<pre');
    expect(html).toContain('line1');
    expect(html).toContain('line2');
  });

  it('converts [text|url] links to anchors that open in a new tab', () => {
    const html = jiraWikiToHtml('see [docs|https://example.com/a]');

    expect(html).toContain('<a href="https://example.com/a"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('>docs</a>');
  });

  it('converts # lines to an ordered list', () => {
    const html = jiraWikiToHtml('# first\n# second\n');

    expect(html).toContain('<ol');
    expect((html.match(/<li /g) ?? []).length).toBe(2);
    expect(html).toContain('>first</li>');
    expect(html).toContain('>second</li>');
    expect(html).not.toContain('# first');
  });

  it('strips multiple # markers for nested numbered items', () => {
    const html = jiraWikiToHtml('## nested\n');

    expect(html).toContain('>nested</li>');
  });

  it('converts * lines to an unordered list', () => {
    const html = jiraWikiToHtml('* alpha\n* beta\n');

    expect(html).toContain('<ul');
    expect((html.match(/list-disc">/g) ?? []).length).toBe(2);
    expect(html).toContain('>alpha</li>');
    expect(html).toContain('>beta</li>');
  });

  it('turns blank lines into new paragraphs and single newlines into <br />', () => {
    const html = jiraWikiToHtml('one\ntwo\n\nthree');

    expect(html).toContain('one<br />two');
    expect(html).toContain('</p><p class="my-2">three');
  });

  it('normalises CRLF line endings', () => {
    const html = jiraWikiToHtml('one\r\ntwo');

    expect(html).toContain('one<br />two');
    expect(html).not.toContain('\r');
  });

  it('renders !image! as a clickable chip when the attachment is known', () => {
    const html = jiraWikiToHtml('before !Screen.PNG! after', [attachment('10101', 'screen.png')]);

    expect(html).toContain('data-attachment-id="10101"');
    expect(html).toContain('data-filename="Screen.PNG"');
    expect(html).toContain('🖼 Screen.PNG');
  });

  it('matches attachment filenames case-insensitively', () => {
    const html = jiraWikiToHtml('!DIAGRAM.png!', [attachment('42', 'diagram.PNG')]);

    expect(html).toContain('data-attachment-id="42"');
  });

  it('ignores image options after the pipe', () => {
    const html = jiraWikiToHtml('!screen.png|width=300!', [attachment('7', 'screen.png')]);

    expect(html).toContain('data-attachment-id="7"');
    expect(html).not.toContain('width=300');
  });

  it('renders a placeholder when no attachment matches', () => {
    const html = jiraWikiToHtml('!missing.png!', [attachment('1', 'other.png')]);

    expect(html).toContain('📎 missing.png');
    expect(html).not.toContain('data-attachment-id');
  });

  it('renders a placeholder when no attachments are supplied at all', () => {
    expect(jiraWikiToHtml('!missing.png!')).toContain('📎 missing.png');
  });

  it('combines several markup features in one document', () => {
    const html = jiraWikiToHtml(
      'h2. Summary\n\n*bold* and _italic_\n\n# step one\n# step two\n',
    );

    expect(html).toContain('<h2');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<ol');
  });
});
