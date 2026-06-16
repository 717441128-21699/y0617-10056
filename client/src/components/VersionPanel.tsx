import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { versionsApi } from '../api';
import { formatTime } from '../utils';

interface DiffData {
  titleDiff: Array<{ value: string; added?: boolean; removed?: boolean }>;
  contentDiff: Array<{ value: string; added?: boolean; removed?: boolean }>;
}

export default function VersionPanel() {
  const { currentDoc, versions, users, rollbackToVersion } = useAppStore();
  const [showDiff, setShowDiff] = useState(false);
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  useEffect(() => {
    if (compareFrom && currentDoc) {
      setLoadingDiff(true);
      versionsApi.diff(currentDoc.id, {
        fromVersion: compareFrom,
        toVersion: compareTo || undefined,
      }).then(data => {
        setDiff(data);
        setLoadingDiff(false);
      }).catch(() => {
        setDiff(null);
        setLoadingDiff(false);
      });
    } else {
      setDiff(null);
    }
  }, [compareFrom, compareTo, currentDoc?.id]);

  if (!currentDoc) return null;

  const handleRollback = (versionId: string) => {
    if (confirm('确定要回滚到此版本吗？当前内容会被保存为新版本。')) {
      rollbackToVersion(currentDoc.id, versionId);
      setShowDiff(false);
      setCompareFrom(null);
      setCompareTo(null);
    }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || id;

  const renderDiffContent = (parts: Array<{ value: string; added?: boolean; removed?: boolean }>) => {
    return parts.map((part, i) => {
      let cls = '';
      if (part.added) cls = 'diff-added';
      if (part.removed) cls = 'diff-removed';
      return (
        <span key={i} className={cls}>{part.value}</span>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-b border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">版本历史</h3>
        {showDiff && (
          <button
            onClick={() => {
              setShowDiff(false);
              setCompareFrom(null);
              setCompareTo(null);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            返回列表
          </button>
        )}
      </div>

      {!showDiff ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {versions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              暂无历史版本
              <p className="mt-1 text-xs">点击「保存版本」按钮创建版本</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {versions.map((version, idx) => (
                <div key={version.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {idx === 0 ? '当前版本' : `版本 ${versions.length - idx}`}
                      </span>
                      {version.message && (
                        <span className="text-xs text-gray-500">
                          - {version.message}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setCompareFrom(version.id);
                        setCompareTo(null);
                        setShowDiff(true);
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      对比
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                    <span>{getUserName(version.createdBy)}</span>
                    <span>·</span>
                    <span>{formatTime(version.createdAt)}</span>
                  </div>
                  {idx > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleRollback(version.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        回滚到此版本
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-600 block">对比基准版本</label>
            <select
              value={compareFrom || ''}
              onChange={e => setCompareFrom(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {versions.map((v, i) => (
                <option key={v.id} value={v.id}>
                  {i === 0 ? '当前版本' : `版本 ${versions.length - i}`} - {formatTime(v.createdAt)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-600 block">目标版本（留空为当前）</label>
            <select
              value={compareTo || ''}
              onChange={e => setCompareTo(e.target.value || null)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">（当前文档）</option>
              {versions.map((v, i) => (
                <option key={v.id} value={v.id}>
                  {i === 0 ? '当前版本' : `版本 ${versions.length - i}`} - {formatTime(v.createdAt)}
                </option>
              ))}
            </select>
          </div>

          {loadingDiff ? (
            <div className="text-center text-gray-500 text-sm py-4">加载中...</div>
          ) : diff ? (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded p-3 bg-white">
                <div className="text-xs font-medium text-gray-500 mb-2">标题变更</div>
                <div className="text-sm whitespace-pre-wrap break-words">
                  {renderDiffContent(diff.titleDiff)}
                </div>
              </div>
              <div className="border border-gray-200 rounded p-3 bg-white">
                <div className="text-xs font-medium text-gray-500 mb-2">内容变更</div>
                <div className="text-sm whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                  {renderDiffContent(diff.contentDiff)}
                </div>
              </div>
              <div className="flex gap-2 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-100" />
                  新增
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-100" />
                  删除
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">选择版本查看差异</div>
          )}
        </div>
      )}
    </div>
  );
}
