import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Trash2, Crown, Shield, User, Eye, Clock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchBox } from '../components/SearchBox';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import {
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  deleteTeam,
  getTeamInvitations,
  cancelTeamInvitation,
  TeamMember,
  TeamInvitation,
} from '../api/teams';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

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

export function TeamMembers() {
  const { teamId, setTeamId } = useWorkspaceStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<string>('member');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [search, setSearch] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => getTeamMembers(teamId!),
    enabled: !!teamId,
  });

  const { data: invitations } = useQuery({
    queryKey: ['team-invitations', teamId],
    queryFn: () => getTeamInvitations(teamId!),
    enabled: !!teamId,
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
      const isInvitation = data && 'type' in data && data.type === 'invitation';
      toast.success(isInvitation ? 'Invitation sent! User will be added when they sign up.' : 'Member added successfully');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to add member');
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateTeamMember(teamId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      toast.success('Role updated');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to update role');
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

  const deleteTeamMutation = useMutation({
    mutationFn: () => deleteTeam(teamId!),
    onSuccess: () => {
      toast.success('Team deleted');
      setTeamId(null);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to delete team');
    },
  });

  const askConfirm = (state: ConfirmState) => setConfirmState(state);

  const matches = (text?: string | null) =>
    !search.trim() || (text ?? '').toLowerCase().includes(search.toLowerCase());
  const filteredMembers = (members ?? []).filter(
    (m: TeamMember) => matches(m.user?.name) || matches(m.user?.email) || matches(m.role)
  );
  const filteredInvitations = (invitations ?? []).filter(
    (i: TeamInvitation) => matches(i.email) || matches(i.role)
  );
  const myRole = members?.find((m: TeamMember) => m.userId === user?.id)?.role;
  const canManageMembers = myRole === 'owner' || myRole === 'admin';
  const totalMembersAndInvites = (members?.length || 0) + (invitations?.length || 0);

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Team</h1>
            <p className="text-sm text-gray-500 mt-1">{totalMembersAndInvites} members &amp; invitations</p>
          </div>
          <div className="flex items-center gap-2">
            {myRole === 'owner' && (
              <button
                onClick={() =>
                  askConfirm({
                    title: 'Delete Team',
                    message: 'Delete this team?\nAll projects, environments, and secrets in it will be permanently deleted.',
                    confirmLabel: 'Delete Team',
                    danger: true,
                    action: () => deleteTeamMutation.mutate(),
                  })
                }
                className="btn btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                disabled={deleteTeamMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
                Delete Team
              </button>
            )}
            {canManageMembers && (
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

        {!!members?.length && (
          <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email, or role" className="mb-4" />
        )}

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (members?.length === 0 && (!invitations || invitations.length === 0)) ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No members</h3>
            <p className="text-gray-500 mb-4">Add team members to collaborate</p>
          </div>
        ) : (
          <div className="space-y-6">
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
                    {filteredMembers.map((member: TeamMember) => (
                      <tr key={member.id} className="border-b last:border-b-0">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{member.user?.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{member.user?.email}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          {canManageMembers && member.role !== 'owner' ? (
                            <div className="flex items-center gap-2">
                              {roleIcons[member.role]}
                              <select
                                className="input py-1 px-2 text-sm w-auto"
                                value={member.role}
                                disabled={updateMemberRoleMutation.isPending}
                                onChange={(e) =>
                                  updateMemberRoleMutation.mutate({
                                    userId: member.userId,
                                    role: e.target.value,
                                  })
                                }
                              >
                                <option value="viewer">Viewer</option>
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {roleIcons[member.role]}
                              <span className="capitalize">{roleLabels[member.role]}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {member.role !== 'owner' && canManageMembers && (
                            <button
                              onClick={() =>
                                askConfirm({
                                  title: 'Remove Member',
                                  message: `Remove ${member.user?.email || 'this member'} from this team?`,
                                  confirmLabel: 'Remove',
                                  danger: true,
                                  action: () => removeMemberMutation.mutate(member.userId),
                                })
                              }
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
                    {filteredInvitations.map((invitation: TeamInvitation) => (
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
                            onClick={() =>
                              askConfirm({
                                title: 'Cancel Invitation',
                                message: `Cancel invitation for ${invitation.email}?`,
                                confirmLabel: 'Cancel Invitation',
                                danger: true,
                                action: () => cancelInvitationMutation.mutate(invitation.id),
                              })
                            }
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

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add Team Member</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newMemberEmail.trim()) {
                    addMemberMutation.mutate({ email: newMemberEmail.trim(), role: newMemberRole });
                  }
                }}
              >
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

        {confirmState && (
          <ConfirmDialog
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            danger={confirmState.danger}
            onConfirm={() => {
              confirmState.action();
              setConfirmState(null);
            }}
            onCancel={() => setConfirmState(null)}
          />
        )}
      </div>
    </Layout>
  );
}
