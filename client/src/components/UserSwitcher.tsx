import { useAppStore } from '../store';

export default function UserSwitcher() {
  const { currentUser, users, switchUser } = useAppStore();

  if (!currentUser) return null;

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: currentUser.avatar }}
        >
          {currentUser.name.charAt(0)}
        </div>
        <span className="text-sm text-gray-700">{currentUser.name}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40 hidden group-hover:block z-50">
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => switchUser(u.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 ${
              u.id === currentUser.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
            }`}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: u.avatar }}
            >
              {u.name.charAt(0)}
            </div>
            {u.name}
          </button>
        ))}
      </div>
    </div>
  );
}
