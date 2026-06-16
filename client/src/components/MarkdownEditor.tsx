import { useMemo, useState, useEffect } from 'react';

interface Props {
  content: string;
  onChange: (html: string, markdown: string) => void;
}

function renderMarkdown(md: string): string {
  let html = md;

  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

  html = html.replace(/^(\d+)\. (.*)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ol>$&</ol>');

  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/^\* (.*)$/gm, '<li>$1</li>');

  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  html = html.replace(/^---$/gm, '<hr />');

  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br />');

  if (html && !html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }

  return html;
}

export default function MarkdownEditor({ content, onChange }: Props) {
  const [localValue, setLocalValue] = useState(content);

  useEffect(() => {
    setLocalValue(content);
  }, [content]);

  const previewHtml = useMemo(() => renderMarkdown(localValue), [localValue]);

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col border-r border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 text-xs font-medium text-gray-500 bg-gray-50">
          Markdown
        </div>
        <textarea
          value={localValue}
          onChange={e => {
            const md = e.target.value;
            setLocalValue(md);
            onChange(renderMarkdown(md), md);
          }}
          className="flex-1 p-4 font-mono text-sm resize-none outline-none bg-white"
          placeholder="在此输入 Markdown..."
          spellCheck={false}
        />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b border-gray-200 text-xs font-medium text-gray-500 bg-gray-50">
          预览
        </div>
        <div
          className="flex-1 p-4 overflow-y-auto ProseMirror"
          dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-gray-400">预览区域</p>' }}
        />
      </div>
    </div>
  );
}
