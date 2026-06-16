import { useAppStore } from '../store';

export default function OnlineUsers() {
  const onlineUsers = useAppStore(s => s.onlineUsers);

  if (onlineUsers.length === 0) return null;

  return (
    <div className="relative group">
      <div className="flex -space-x-2">
        {onlineUsers.slice(0, 3).map(user => (
          <div
            key={user.socketId}
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: user.avatar }}
            title={user.name}
          >
            {user.name.charAt(0)}
          </div>
        ))}
        {onlineUsers.length > 3 && (
          <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-white text-xs font-medium">
            +{onlineUsers.length - 3}
          </div>
        )}
      </div>

      <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-48 hidden group-hover:block z-50">
        <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
          正在编辑 ({onlineUsers.length})
        </div>
        {onlineUsers.map(user => (
          <div
            key={user.socketId}
            className="flex items-center gap-2 px-3 py-2 text-sm"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: user.avatar }}
            >
              {user.name.charAt(0)}
            </div>
            <span className="text-gray-700">{user.name}</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-green-500" />
          </div>
        ))}
      </div>
    </div>
  );
}
