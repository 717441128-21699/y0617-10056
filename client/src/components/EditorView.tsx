import { useEffect, useCallback, useRef } from 'react';
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
  const {
    currentDoc,
    currentUser,
    editorMode,
    setEditorMode,
    updateDoc,
    saveDraft,
    getDraft,
    clearDraft,
    setOnlineUsers,
  } = useAppStore();

  const socketRef = useRef<Socket | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTitleRef = useRef('');
  const localContentRef = useRef('');
  const localMarkdownRef = useRef('');

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

    socket.on('online-users', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, setOnlineUsers]);

  useEffect(() => {
    if (!currentDoc || !socketRef.current) return;
    const socket = socketRef.current;

    socket.emit('join-doc', { docId: currentDoc.id });

    socket.on('doc-changed', () => {
      useAppStore.getState().selectDoc(currentDoc.id);
    });

    return () => {
      socket.emit('leave-doc', { docId: currentDoc.id });
      setOnlineUsers([]);
    };
  }, [currentDoc?.id, setOnlineUsers]);

  useEffect(() => {
    if (!currentDoc) return;

    const draft = getDraft(currentDoc.id);
    if (draft && draft.savedAt > currentDoc.updatedAt) {
      if (confirm('发现未保存的草稿，是否恢复？')) {
        localTitleRef.current = draft.title;
        localContentRef.current = draft.content;
        localMarkdownRef.current = draft.markdown;
        return;
      } else {
        clearDraft(currentDoc.id);
      }
    }

    localTitleRef.current = currentDoc.title;
    localContentRef.current = currentDoc.content;
    localMarkdownRef.current = currentDoc.markdown;
  }, [currentDoc?.id, currentDoc?.updatedAt]);

  const triggerAutoSave = useCallback(() => {
    if (!currentDoc) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      const title = localTitleRef.current;
      const content = localContentRef.current;
      const markdown = localMarkdownRef.current;

      if (
        title !== currentDoc.title ||
        content !== currentDoc.content ||
        markdown !== currentDoc.markdown
      ) {
        saveDraft(currentDoc.id, {
          title,
          content,
          markdown,
          savedAt: Date.now(),
        });

        await updateDoc(currentDoc.id, {
          title,
          content,
          markdown,
        });

        clearDraft(currentDoc.id);

        socketRef.current?.emit('doc-updated', { docId: currentDoc.id });
      }
    }, 2000);
  }, [currentDoc, updateDoc, saveDraft, clearDraft]);

  const handleContentChange = useCallback((content: string, markdown: string) => {
    localContentRef.current = content;
    localMarkdownRef.current = markdown;
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleTitleChange = useCallback((title: string) => {
    localTitleRef.current = title;
    triggerAutoSave();
  }, [triggerAutoSave]);

  const handleModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode);
  }, [setEditorMode]);

  const handleSaveVersion = useCallback(async () => {
    if (!currentDoc) return;
    const message = prompt('版本说明（可选）:');
    await updateDoc(currentDoc.id, {
      title: localTitleRef.current,
      content: localContentRef.current,
      markdown: localMarkdownRef.current,
      saveVersion: true,
      versionMessage: message || undefined,
    });
    clearDraft(currentDoc.id);
    alert('版本已保存');
  }, [currentDoc, updateDoc, clearDraft]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
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
                onClick={() => handleModeChange('richtext')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  editorMode === 'richtext' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                富文本
              </button>
              <button
                onClick={() => handleModeChange('markdown')}
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
            value={localTitleRef.current}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="无标题文档"
            className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 outline-none bg-transparent"
          />
          <div className="mt-2 mb-4 text-xs text-gray-400">
            编辑时自动保存草稿
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {editorMode === 'richtext' ? (
            <RichTextEditor
              key={currentDoc.id}
              docId={currentDoc.id}
              content={localContentRef.current}
              onChange={handleContentChange}
              userId={currentUser?.id}
              userName={currentUser?.name}
              userColor={currentUser?.avatar}
            />
          ) : (
            <MarkdownEditor
              content={localMarkdownRef.current}
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
