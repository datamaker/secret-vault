import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Copy, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyText } from '../lib/clipboard';
import { Layout } from '../components/layout/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useWorkspaceStore } from '../store/workspaceStore';
import { getProjects, Project } from '../api/projects';
import { getTeamTokens, createTeamToken, revokeTeamToken, ApiToken } from '../api/apiTokens';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

export function Tokens() {
  const { teamId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiryDays, setNewTokenExpiryDays] = useState<string>('never');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { data: apiTokens, isLoading } = useQuery({
    queryKey: ['team-tokens', teamId],
    queryFn: () => getTeamTokens(teamId!),
    enabled: !!teamId,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => getProjects(teamId!),
    enabled: !!teamId,
  });

  const createTokenMutation = useMutation({
    mutationFn: ({ name, expiresAt }: { name: string; expiresAt?: string }) =>
      createTeamToken(teamId!, name, expiresAt),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['team-tokens', teamId] });
      setShowCreateModal(false);
      setNewTokenName('');
      setNewTokenExpiryDays('never');
      setCreatedToken(data.token);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to create API key');
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (tokenId: string) => revokeTeamToken(teamId!, tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-tokens', teamId] });
      toast.success('API key revoked');
    },
    onError: () => {
      toast.error('Failed to revoke API key');
    },
  });

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    let expiresAt: string | undefined;
    if (newTokenExpiryDays !== 'never') {
      const d = new Date();
      d.setDate(d.getDate() + Number(newTokenExpiryDays));
      expiresAt = d.toISOString();
    }
    createTokenMutation.mutate({ name: newTokenName.trim(), expiresAt });
  };

  const handleCopyToken = async () => {
    if (!createdToken) return;
    (await copyText(createdToken)) ? toast.success('Copied to clipboard') : toast.error('Copy failed');
  };

  const projectNameById = new Map((projects ?? []).map((p: Project) => [p.id, p.name]));

  const tokenScopeLabel = (t: ApiToken): string => {
    if (t.projectId) return projectNameById.get(t.projectId) ?? 'Project';
    return 'All projects';
  };

  const tokenStatus = (t: ApiToken): 'active' | 'revoked' | 'expired' => {
    if (t.isRevoked) return 'revoked';
    if (t.expiresAt && new Date(t.expiresAt) < new Date()) return 'expired';
    return 'active';
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Tokens</h1>
            <p className="text-sm text-gray-500 mt-1">
              Read-only API keys for CI/CD and the secret-fetcher Lambda.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
            disabled={!teamId}
          >
            <KeyRound className="w-4 h-4" />
            New API Key
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : !apiTokens || apiTokens.length === 0 ? (
          <div className="text-center py-12">
            <KeyRound className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No API keys</h3>
            <p className="text-gray-500 mb-4">
              Create a read-only API key for CI/CD to fetch secrets from every project in this team
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              Create Your First API Key
            </button>
          </div>
        ) : (
          <div className="card">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-600">Name</th>
                  <th className="text-left p-4 font-medium text-gray-600">Key</th>
                  <th className="text-left p-4 font-medium text-gray-600">Scope</th>
                  <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  <th className="text-left p-4 font-medium text-gray-600">Last Used</th>
                  <th className="text-left p-4 font-medium text-gray-600">Expires</th>
                  <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiTokens.map((token: ApiToken) => {
                  const status = tokenStatus(token);
                  return (
                    <tr key={token.id} className="border-b last:border-b-0">
                      <td className="p-4 font-medium">{token.name}</td>
                      <td className="p-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {token.tokenPrefix}…
                        </code>
                      </td>
                      <td className="p-4 text-sm">{tokenScopeLabel(token)}</td>
                      <td className="p-4">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : status === 'expired'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="p-4 text-right">
                        {!token.isRevoked && (
                          <button
                            onClick={() =>
                              setConfirmState({
                                title: 'Revoke API Key',
                                message: `Revoke API key "${token.name}"?\nAnything using it will stop working immediately.`,
                                confirmLabel: 'Revoke',
                                danger: true,
                                action: () => revokeTokenMutation.mutate(token.id),
                              })
                            }
                            className="text-red-500 hover:text-red-700 p-2"
                            title="Revoke key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Create API Key Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create API Key</h2>
              <p className="text-sm text-gray-500 mb-4">
                Read-only key with access to every project in this team. Use it for CI/CD secret fetching.
              </p>
              <form onSubmit={handleCreateToken}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    className="input"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="circleci-prod"
                    autoFocus
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
                  <select
                    className="input"
                    value={newTokenExpiryDays}
                    onChange={(e) => setNewTokenExpiryDays(e.target.value)}
                  >
                    <option value="never">Never</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewTokenName('');
                      setNewTokenExpiryDays('never');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createTokenMutation.isPending}
                  >
                    {createTokenMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Created Token — shown once */}
        {createdToken && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold mb-2">API Key Created</h2>
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Copy this key now — it won't be shown again. Only a hash is stored on the server.
                </p>
              </div>
              <div className="flex items-center gap-2 mb-6">
                <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded break-all">
                  {createdToken}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="btn btn-secondary flex items-center gap-2 shrink-0"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <div className="flex justify-end">
                <button className="btn btn-primary" onClick={() => setCreatedToken(null)}>
                  Done
                </button>
              </div>
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
