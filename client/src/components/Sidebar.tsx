import { useState } from 'react';
import { useAppStore } from '../store';
import DocTree from './DocTree';

export default function Sidebar() {
  const { spaces, currentSpaceId, selectSpace, createDoc, currentSpaceId: _spaceId } = useAppStore();
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');

  const createSpace = useAppStore(s => s.createSpace);

  const handleCreateSpace = () => {
    if (newSpaceName.trim()) {
      createSpace(newSpaceName.trim());
      setNewSpaceName('');
      setShowNewSpace(false);
    }
  };

  const handleNewFolder = () => {
    if (!currentSpaceId) return;
    const title = prompt('文件夹名称:');
    if (title?.trim()) {
      createDoc({ spaceId: currentSpaceId, title: title.trim(), type: 'folder' });
    }
  };

  const handleNewDoc = () => {
    if (!currentSpaceId) return;
    const title = prompt('文档名称:');
    if (title?.trim()) {
      createDoc({ spaceId: currentSpaceId, title: title.trim(), type: 'document' })
        .then(doc => useAppStore.getState().selectDoc(doc.id));
    }
  };

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-3 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-500 uppercase mb-2">工作空间</div>
        <div className="space-y-1">
          {spaces.map(space => (
            <button
              key={space.id}
              onClick={() => selectSpace(space.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                currentSpaceId === space.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="truncate">{space.name}</span>
            </button>
          ))}
        </div>
        {showNewSpace ? (
          <div className="mt-2 flex gap-1">
            <input
              autoFocus
              value={newSpaceName}
              onChange={e => setNewSpaceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateSpace()}
              placeholder="空间名称"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleCreateSpace}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              添加
            </button>
            <button
              onClick={() => setShowNewSpace(false)}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewSpace(true)}
            className="mt-2 w-full text-left px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建空间
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="text-xs font-medium text-gray-500 uppercase">文档</div>
        <div className="flex gap-1">
          <button
            onClick={handleNewFolder}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="新建文件夹"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              <path stroke="#fff" strokeWidth="2" d="M8 11h4M10 9v4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={handleNewDoc}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="新建文档"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {currentSpaceId && <DocTree />}
      </div>
    </aside>
  );
}
