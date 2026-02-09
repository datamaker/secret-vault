import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Key, Users, FolderOpen } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logout as logoutApi } from '../../api/auth';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <Key className="w-6 h-6" />
            Secret Vault
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FolderOpen className="w-5 h-5" />
            Dashboard
          </Link>
          <Link
            to="/teams"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Users className="w-5 h-5" />
            Teams
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-gray-400 text-xs">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
