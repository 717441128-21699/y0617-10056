import { useAppStore } from '../store';
import type { PermissionLevel } from '../types';

const permissionOptions: { value: PermissionLevel; label: string; desc: string; icon: string }[] = [
  {
    value: 'public',
    label: '公开',
    desc: '任何人可访问',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    value: 'team',
    label: '团队可见',
    desc: '团队成员可访问',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    value: 'private',
    label: '仅指定成员',
    desc: '仅允许指定用户',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  },
];

export default function PermissionPanel() {
  const { currentDoc, users, updateDoc } = useAppStore();

  if (!currentDoc) return null;

  const handlePermissionChange = (permission: PermissionLevel) => {
    updateDoc(currentDoc.id, { permission });
  };

  const toggleUserAccess = (userId: string) => {
    const current = currentDoc.allowedUsers || [];
    const exists = current.find(u => u.userId === userId);
    let next;
    if (exists) {
      next = current.filter(u => u.userId !== userId);
    } else {
      next = [...current, { userId, canEdit: true }];
    }
    updateDoc(currentDoc.id, { allowedUsers: next });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">文档权限</h3>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        <div className="space-y-2">
          {permissionOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => handlePermissionChange(opt.value)}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                currentDoc.permission === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-4 h-4 ${
                    currentDoc.permission === opt.value ? 'text-blue-600' : 'text-gray-500'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                </svg>
                <span className={`text-sm font-medium ${
                  currentDoc.permission === opt.value ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {opt.label}
                </span>
              </div>
              <div className="mt-0.5 ml-6 text-xs text-gray-500">{opt.desc}</div>
            </button>
          ))}
        </div>

        {currentDoc.permission === 'private' && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">可访问成员</div>
            <div className="space-y-1">
              {users.map(user => {
                const hasAccess = currentDoc.allowedUsers?.some(u => u.userId === user.id);
                return (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!hasAccess}
                      onChange={() => toggleUserAccess(user.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: user.avatar }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-700">{user.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 text-xs text-gray-500 space-y-1">
          <p>创建者: {users.find(u => u.id === currentDoc.createdBy)?.name || currentDoc.createdBy}</p>
          <p>最后更新: {users.find(u => u.id === currentDoc.updatedBy)?.name || currentDoc.updatedBy}</p>
        </div>
      </div>
    </div>
  );
}
