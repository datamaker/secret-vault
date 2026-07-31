import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Key, Users, FolderOpen, Lock, ListOrdered, KeyRound, Plus, Send, ChevronDown, Fingerprint, Cloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { logout as logoutApi, changePassword } from '../../api/auth';
import { getTeams, createTeam, Team } from '../../api/teams';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Projects', icon: FolderOpen },
  { to: '/activity', label: 'Activity', icon: ListOrdered },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/credentials', label: 'Credentials', icon: Fingerprint },
  { to: '/tokens', label: 'Tokens', icon: KeyRound },
  { to: '/integrations', label: 'Integrations', icon: Cloud },
  { to: '/share', label: 'Share Secret', icon: Send },
];

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const { teamId, setTeamId } = useWorkspaceStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  // 선택된 팀이 없거나 더 이상 존재하지 않으면 첫 팀으로 보정
  useEffect(() => {
    if (!teams) return;
    if (teams.length === 0) {
      if (teamId) setTeamId(null);
      return;
    }
    if (!teamId || !teams.some((t: Team) => t.id === teamId)) {
      setTeamId(teams[0].id);
    }
  }, [teams, teamId, setTeamId]);

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setTeamId(team.id);
      setShowCreateTeamModal(false);
      setNewTeamName('');
      toast.success('Team created');
      navigate('/');
    },
    onError: () => {
      toast.error('Failed to create team');
    },
  });

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChanging(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      closePasswordModal();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <NavLink to="/" className="flex items-center gap-2 text-xl font-bold">
            <Key className="w-6 h-6" />
            Secret Vault
          </NavLink>
        </div>

        {/* Workspace (team) selector */}
        <div className="p-4 border-b border-gray-800">
          <label className="block text-xs text-gray-400 mb-1">Workspace</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-9 py-2 text-sm text-white truncate"
                value={teamId ?? ''}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  navigate('/');
                }}
              >
                {(teams ?? []).map((team: Team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
                {(!teams || teams.length === 0) && <option value="">No teams</option>}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 shrink-0"
              title="Create team"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 text-gray-300'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">{user?.name}</div>
              <div className="text-gray-400 text-xs">{user?.email}</div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Change password"
              >
                <Lock className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900">
            <h2 className="text-xl font-bold mb-4">Create New Team</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newTeamName.trim()) createTeamMutation.mutate(newTeamName.trim());
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                <input
                  type="text"
                  className="input"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="My Team"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateTeamModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createTeamMutation.isPending}>
                  {createTeamMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-gray-900">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  className="input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={closePasswordModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changing || !currentPassword || !newPassword || !confirmPassword}
                >
                  {changing ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
