import { useEffect } from 'react';
import { useAppStore } from './store';
import Sidebar from './components/Sidebar';
import EditorView from './components/EditorView';
import SearchBar from './components/SearchBar';
import UserSwitcher from './components/UserSwitcher';

export default function App() {
  const init = useAppStore(s => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">团队知识库</h1>
        <div className="flex-1 max-w-xl">
          <SearchBar />
        </div>
        <UserSwitcher />
      </header>
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <EditorView />
      </div>
    </div>
  );
}
