import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderOpen, ArrowLeft, Users, UserPlus, Trash2, Crown, Shield, User, Eye, Clock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import {
  getTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  getTeamInvitations,
  cancelTeamInvitation,
  TeamMember,
  TeamInvitation,
} from '../api/teams';
import { getProjects, createProject, Project } from '../api/projects';

type TabType = 'projects' | 'members';

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="w-4 h-4 text-yellow-500" />,
  admin: <Shield className="w-4 h-4 text-blue-500" />,
  member: <User className="w-4 h-4 text-green-500" />,
  viewer: <Eye className="w-4 h-4 text-gray-500" />,
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<string>('member');

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId!),
    enabled: !!teamId,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => getProjects(teamId!),
    enabled: !!teamId,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => getTeamMembers(teamId!),
    enabled: !!teamId,
  });

  const { data: invitations } = useQuery({
    queryKey: ['team-invitations', teamId],
    queryFn: () => getTeamInvitations(teamId!),
    enabled: !!teamId,
  });

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => createProject(teamId!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      setShowCreateModal(false);
      setNewProjectName('');
      toast.success('Project created successfully');
    },
    onError: () => {
      toast.error('Failed to create project');
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      addTeamMember(teamId!, email, role),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] });
      setShowAddMemberModal(false);
      setNewMemberEmail('');
      setNewMemberRole('member');
      // Check if it's an invitation based on response
      const isInvitation = data && 'type' in data && data.type === 'invitation';
      if (isInvitation) {
        toast.success('Invitation sent! User will be added when they sign up.');
      } else {
        toast.success('Member added successfully');
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to add member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      toast.success('Member removed');
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => cancelTeamInvitation(teamId!, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', teamId] });
      toast.success('Invitation cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel invitation');
    },
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      createProjectMutation.mutate(newProjectName);
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemberEmail.trim()) {
      addMemberMutation.mutate({ email: newMemberEmail, role: newMemberRole });
    }
  };

  const handleRemoveMember = (userId: string, email: string) => {
    if (confirm(`Remove ${email} from this team?`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  const handleCancelInvitation = (invitationId: string, email: string) => {
    if (confirm(`Cancel invitation for ${email}?`)) {
      cancelInvitationMutation.mutate(invitationId);
    }
  };

  const totalMembersAndInvites = (members?.length || 0) + (invitations?.length || 0);

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{team?.name || 'Loading...'}</h1>
            {activeTab === 'projects' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
            {activeTab === 'members' && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-2 px-1 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'projects'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Projects ({projects?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-2 px-1 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Members ({totalMembersAndInvites})
          </button>
        </div>

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <>
            {projectsLoading ? (
              <div className="text-center py-12">Loading...</div>
            ) : projects?.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                <p className="text-gray-500 mb-4">Create a project to start managing secrets</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn btn-primary"
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects?.map((project: Project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="card p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <FolderOpen className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                        <p className="text-sm text-gray-500">{project.slug}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <>
            {membersLoading ? (
              <div className="text-center py-12">Loading...</div>
            ) : (members?.length === 0 && (!invitations || invitations.length === 0)) ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No members</h3>
                <p className="text-gray-500 mb-4">Add team members to collaborate</p>
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="btn btn-primary"
                >
                  Add First Member
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Members */}
                {members && members.length > 0 && (
                  <div className="card">
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-medium text-gray-700">Active Members ({members.length})</h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-4 font-medium text-gray-600">User</th>
                          <th className="text-left p-4 font-medium text-gray-600">Role</th>
                          <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member: TeamMember) => (
                          <tr key={member.id} className="border-b last:border-b-0">
                            <td className="p-4">
                              <div>
                                <div className="font-medium">{member.user?.name || 'Unknown'}</div>
                                <div className="text-sm text-gray-500">{member.user?.email}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {roleIcons[member.role]}
                                <span className="capitalize">{roleLabels[member.role]}</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {member.role !== 'owner' && (
                                <button
                                  onClick={() => handleRemoveMember(member.userId, member.user?.email || '')}
                                  className="text-red-500 hover:text-red-700 p-2"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pending Invitations */}
                {invitations && invitations.length > 0 && (
                  <div className="card">
                    <div className="p-4 border-b bg-yellow-50">
                      <h3 className="font-medium text-yellow-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pending Invitations ({invitations.length})
                      </h3>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-4 font-medium text-gray-600">Email</th>
                          <th className="text-left p-4 font-medium text-gray-600">Role</th>
                          <th className="text-left p-4 font-medium text-gray-600">Expires</th>
                          <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.map((invitation: TeamInvitation) => (
                          <tr key={invitation.id} className="border-b last:border-b-0">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span>{invitation.email}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {roleIcons[invitation.role]}
                                <span className="capitalize">{roleLabels[invitation.role]}</span>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-gray-500">
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                                className="text-red-500 hover:text-red-700 p-2"
                                title="Cancel invitation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create New Project</h2>
              <form onSubmit={handleCreateProject}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="My Project"
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
                    disabled={createProjectMutation.isPending}
                  >
                    {createProjectMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add Team Member</h2>
              <form onSubmit={handleAddMember}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    autoFocus
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    If user hasn't signed up yet, an invitation will be sent
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    className="input"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="viewer">Viewer - Can view secrets</option>
                    <option value="member">Member - Can manage secrets</option>
                    <option value="admin">Admin - Can manage team &amp; projects</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setNewMemberEmail('');
                      setNewMemberRole('member');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addMemberMutation.isPending}
                  >
                    {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
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
