import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, FolderOpen, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { getTeams, createTeam, Team } from '../api/teams';

export function Dashboard() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateModal(false);
      setNewTeamName('');
      toast.success('Team created successfully');
    },
    onError: () => {
      toast.error('Failed to create team');
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      createTeamMutation.mutate(newTeamName);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Team
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : teams?.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
            <p className="text-gray-500 mb-4">Create a team to start managing your secrets</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Create Your First Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams?.map((team: Team) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="card p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-100 rounded-lg">
                    <FolderOpen className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{team.name}</h3>
                    <p className="text-sm text-gray-500">{team.slug}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Team Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create New Team</h2>
              <form onSubmit={handleCreateTeam}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Name
                  </label>
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
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createTeamMutation.isPending}
                  >
                    {createTeamMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
