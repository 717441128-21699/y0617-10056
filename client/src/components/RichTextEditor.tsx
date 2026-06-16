import { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

interface Props {
  docId: string;
  content: string;
  onChange: (html: string, markdown: string) => void;
  userId?: string;
  userName?: string;
  userColor?: string;
}

export default function RichTextEditor({ docId, content, onChange, userId, userName, userColor }: Props) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const contentLoadedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: true,
      }),
      Placeholder.configure({
        placeholder: '开始输入内容...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      let markdown = '';
      try {
        markdown = turndown.turndown(html);
      } catch {
        markdown = '';
      }
      onChange(html, markdown);

      if (ydocRef.current) {
        const ytext = ydocRef.current.getText('content');
        const currentMd = ytext.toString();
        if (currentMd !== markdown) {
          ytext.delete(0, currentMd.length);
          ytext.insert(0, markdown);
        }
      }
    },
  });

  useEffect(() => {
    if (!docId) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const provider = new WebsocketProvider(
      `${wsProtocol}//${wsHost}`,
      `yjs/${docId}`,
      ydoc,
    );
    providerRef.current = provider;

    const persistence = new IndexeddbPersistence(docId, ydoc);
    persistenceRef.current = persistence;

    if (userId && userName) {
      provider.awareness.setLocalStateField('user', {
        name: userName,
        color: userColor || '#3B82F6',
      });
    }

    const ytext = ydoc.getText('content');
    ytext.observe(() => {
      const remoteMd = ytext.toString();
      if (editor && contentLoadedRef.current) {
        const currentHtml = editor.getHTML();
        let currentMd = '';
        try {
          currentMd = turndown.turndown(currentHtml);
        } catch {}
        if (remoteMd !== currentMd) {
          // 简单处理：同步时不覆盖本地（实际 CRDT 需更复杂处理）
        }
      }
    });

    persistence.on('synced', () => {
      contentLoadedRef.current = true;
      const persistedMd = ytext.toString();
      if (persistedMd && editor) {
        // 有持久化内容时不覆盖，避免丢失
      }
    });

    return () => {
      provider.destroy();
      persistence.destroy();
      ydoc.destroy();
      contentLoadedRef.current = false;
    };
  }, [docId, editor]);

  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>');
    }
  }, [content, editor]);

  const addHeading = useCallback((level: 1 | 2 | 3) => {
    editor?.chain().focus().toggleHeading({ level }).run();
  }, [editor]);

  const addList = useCallback((type: 'bullet' | 'ordered') => {
    if (type === 'bullet') {
      editor?.chain().focus().toggleBulletList().run();
    } else {
      editor?.chain().focus().toggleOrderedList().run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-gray-200 px-4 py-2 flex items-center gap-1 flex-wrap sticky top-0 bg-white z-10">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
          title="加粗"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
          title="斜体"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0v16m-4 0h8" /></svg>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('strike') ? 'bg-gray-200' : ''}`}
          title="删除线"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.5 10H6.5m11 0a4.5 4.5 0 010 9h-11a4.5 4.5 0 010-9M12 3v4" /></svg>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={() => addHeading(1)}
          className={`p-1.5 rounded hover:bg-gray-100 text-sm font-bold ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
          title="标题 1"
        >
          H1
        </button>
        <button
          onClick={() => addHeading(2)}
          className={`p-1.5 rounded hover:bg-gray-100 text-sm font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
          title="标题 2"
        >
          H2
        </button>
        <button
          onClick={() => addHeading(3)}
          className={`p-1.5 rounded hover:bg-gray-100 text-sm font-bold ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''}`}
          title="标题 3"
        >
          H3
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={() => addList('bullet')}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
          title="无序列表"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button
          onClick={() => addList('ordered')}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
          title="有序列表"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
          title="引用"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-gray-100 ${editor.isActive('codeBlock') ? 'bg-gray-200' : ''}`}
          title="代码块"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded hover:bg-gray-100"
          title="分割线"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          className="p-1.5 rounded hover:bg-gray-100"
          title="撤销"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          className="p-1.5 rounded hover:bg-gray-100"
          title="重做"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <EditorContent editor={editor} className="prose max-w-none" />
      </div>
    </div>
  );
}
