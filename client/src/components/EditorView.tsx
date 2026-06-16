import { useEffect, useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store';
import RichTextEditor from './RichTextEditor';
import MarkdownEditor from './MarkdownEditor';
import OnlineUsers from './OnlineUsers';
import VersionPanel from './VersionPanel';
import PermissionPanel from './PermissionPanel';
import { formatTime } from '../utils';
import type { EditorMode } from '../types';

export default function EditorView() {
  const currentDoc = useAppStore(s => s.currentDoc);
  const currentUser = useAppStore(s => s.currentUser);
  const editorMode = useAppStore(s => s.editorMode);
  const setEditorMode = useAppStore(s => s.setEditorMode);
  const updateDoc = useAppStore(s => s.updateDoc);
  const saveDraft = useAppStore(s => s.saveDraft);
  const getDraft = useAppStore(s => s.getDraft);
  const clearDraft = useAppStore(s => s.clearDraft);
  const setOnlineUsers = useAppStore(s => s.setOnlineUsers);

  const socketRef = useRef<Socket | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDocIdRef = useRef<string | null>(null);
  const isRemoteUpdateRef = useRef(false);

  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [localMarkdown, setLocalMarkdown] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const socket = io('/', {
      extraHeaders: {
        'X-User-Id': currentUser.id,
        'X-User-Name': encodeURIComponent(currentUser.name),
        'X-User-Avatar': encodeURIComponent(currentUser.avatar),
      },
    });
    socketRef.current = socket;
    socket.on('online-users', (users) => setOnlineUsers(users));
    return () => { socket.disconnect(); };
  }, [currentUser?.id, setOnlineUsers]);

  useEffect(() => {
    if (!currentDoc || !socketRef.current) return;
    const socket = socketRef.current;

    socket.emit('join-doc', { docId: currentDoc.id });

    const handler = ({ docId, title, content, markdown }: { docId: string; title?: string; content?: string; markdown?: string }) => {
      if (docId !== currentDoc.id) return;
      if (title !== undefined && content !== undefined && markdown !== undefined) {
        isRemoteUpdateRef.current = true;
        setLocalTitle(title);
        setLocalContent(content);
        setLocalMarkdown(markdown);
        isRemoteUpdateRef.current = false;
      } else {
        useAppStore.getState().selectDoc(currentDoc.id);
      }
    };
    socket.on('doc-changed', handler);

    return () => {
      socket.emit('leave-doc', { docId: currentDoc.id });
      socket.off('doc-changed', handler);
      setOnlineUsers([]);
    };
  }, [currentDoc?.id, setOnlineUsers]);

  useEffect(() => {
    if (!currentDoc) {
      setLocalTitle('');
      setLocalContent('');
      setLocalMarkdown('');
      lastSavedDocIdRef.current = null;
      return;
    }

    if (lastSavedDocIdRef.current === currentDoc.id) return;
    lastSavedDocIdRef.current = currentDoc.id;

    const draft = getDraft(currentDoc.id);
    if (draft && draft.savedAt > currentDoc.updatedAt) {
      if (confirm('发现未保存的草稿，是否恢复？')) {
        setLocalTitle(draft.title);
        setLocalContent(draft.content);
        setLocalMarkdown(draft.markdown);
        return;
      } else {
        clearDraft(currentDoc.id);
      }
    }

    setLocalTitle(currentDoc.title);
    setLocalContent(currentDoc.content);
    setLocalMarkdown(currentDoc.markdown);
  }, [currentDoc?.id, currentDoc?.updatedAt]);

  const triggerAutoSave = useCallback(() => {
    if (!currentDoc) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      if (isRemoteUpdateRef.current) return;

      const title = localTitle;
      const content = localContent;
      const markdown = localMarkdown;
      const latestDoc = useAppStore.getState().currentDoc;
      if (!latestDoc) return;

      if (title !== latestDoc.title || content !== latestDoc.content || markdown !== latestDoc.markdown) {
        saveDraft(latestDoc.id, { title, content, markdown, savedAt: Date.now() });
        await updateDoc(latestDoc.id, { title, content, markdown });
        clearDraft(latestDoc.id);
        socketRef.current?.emit('doc-updated', { docId: latestDoc.id });
      }
    }, 2000);
  }, [currentDoc?.id, localTitle, localContent, localMarkdown, updateDoc, saveDraft, clearDraft]);

  const handleContentChange = useCallback((content: string, markdown: string) => {
    setLocalContent(content);
    setLocalMarkdown(markdown);
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleTitleChange = useCallback((title: string) => {
    setLocalTitle(title);
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleSaveVersion = useCallback(async () => {
    if (!currentDoc) return;
    const message = prompt('版本说明（可选）:');
    await updateDoc(currentDoc.id, {
      title: localTitle,
      content: localContent,
      markdown: localMarkdown,
      saveVersion: true,
      versionMessage: message || undefined,
    });
    clearDraft(currentDoc.id);
    alert('版本已保存');
  }, [currentDoc?.id, localTitle, localContent, localMarkdown, updateDoc, clearDraft]);

  useEffect(() => {
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, []);

  if (!currentDoc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg">选择或创建一个文档开始编辑</p>
          <p className="text-sm mt-2">在左侧面板点击文档，或使用 + 按钮创建新文档</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setEditorMode('richtext')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  editorMode === 'richtext' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                富文本
              </button>
              <button
                onClick={() => setEditorMode('markdown')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  editorMode === 'markdown' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Markdown
              </button>
            </div>
            <span className="text-xs text-gray-500">
              最后更新: {formatTime(currentDoc.updatedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <OnlineUsers />
            <button
              onClick={handleSaveVersion}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              保存版本
            </button>
          </div>
        </div>

        <div className="border-b border-gray-100 px-8 pt-6">
          <input
            type="text"
            value={localTitle}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="无标题文档"
            className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 outline-none bg-transparent"
          />
          <div className="mt-2 mb-4 text-xs text-gray-400">编辑时自动保存草稿</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {editorMode === 'richtext' ? (
            <RichTextEditor
              key={currentDoc.id}
              docId={currentDoc.id}
              content={localContent}
              onChange={handleContentChange}
              userId={currentUser?.id}
              userName={currentUser?.name}
              userColor={currentUser?.avatar}
            />
          ) : (
            <MarkdownEditor
              key={currentDoc.id}
              content={localMarkdown}
              onChange={handleContentChange}
            />
          )}
        </div>
      </div>

      <aside className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col shrink-0">
        <VersionPanel />
        <PermissionPanel />
      </aside>
    </div>
  );
}
