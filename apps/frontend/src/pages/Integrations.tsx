import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2, Cloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useWorkspaceStore } from '../store/workspaceStore';
import { getProjects, getEnvironments, Project, Environment } from '../api/projects';
import {
  getIntegrations,
  createIntegration,
  deleteIntegration,
  syncIntegration,
  Integration,
} from '../api/integrations';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

const emptyForm = { name: '', projectId: '', environmentId: '', ownerSlug: '', contextName: '', token: '' };

export function Integrations() {
  const { teamId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations', teamId],
    queryFn: () => getIntegrations(teamId!),
    enabled: !!teamId,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', teamId],
    queryFn: () => getProjects(teamId!),
    enabled: !!teamId && showModal,
  });

  const { data: environments } = useQuery({
    queryKey: ['environments', form.projectId],
    queryFn: () => getEnvironments(form.projectId),
    enabled: !!form.projectId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createIntegration(teamId!, {
        name: form.name,
        environmentId: form.environmentId,
        ownerSlug: form.ownerSlug,
        contextName: form.contextName,
        token: form.token,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', teamId] });
      setShowModal(false);
      setForm(emptyForm);
      toast.success('Integration created — running first sync');
      syncMutation.mutate(created.id);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to create integration');
    },
  });

  const syncMutation = useMutation({
    mutationFn: (integrationId: string) => syncIntegration(teamId!, integrationId),
    onSuccess: ({ synced, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', teamId] });
      if (failed.length > 0) {
        toast.error(`Synced ${synced}, failed: ${failed.join(', ')}`);
      } else {
        toast.success(`Synced ${synced} secrets to CircleCI`);
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      queryClient.invalidateQueries({ queryKey: ['integrations', teamId] });
      toast.error(error.response?.data?.message || 'Sync failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (integrationId: string) => deleteIntegration(teamId!, integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', teamId] });
      toast.success('Integration deleted');
    },
    onError: () => toast.error('Failed to delete integration'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.environmentId || !form.ownerSlug || !form.contextName || !form.token) {
      toast.error('All fields are required');
      return;
    }
    createMutation.mutate();
  };

  const statusBadge = (integration: Integration) => {
    const status = integration.lastSyncStatus;
    if (!status) return <span className="text-xs text-gray-400">Never synced</span>;
    const styles: Record<string, string> = {
      success: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      error: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-sm text-gray-500 mt-1">
              One-way sync: vault pushes secrets into a CircleCI context. Your pipelines keep reading
              plain environment variables — no vault call at deploy time.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2"
            disabled={!teamId}
          >
            <Plus className="w-4 h-4" />
            New Integration
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : !integrations || integrations.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations</h3>
            <p className="text-gray-500 mb-4">
              Connect an environment to a CircleCI context to keep its secrets in sync automatically
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              Create Your First Integration
            </button>
          </div>
        ) : (
          <div className="card">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-600">Name</th>
                  <th className="text-left p-4 font-medium text-gray-600">Source</th>
                  <th className="text-left p-4 font-medium text-gray-600">Target</th>
                  <th className="text-left p-4 font-medium text-gray-600">Last Sync</th>
                  <th className="text-right p-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((integration: Integration) => (
                  <tr key={integration.id} className="border-b last:border-b-0">
                    <td className="p-4">
                      <div className="font-medium">{integration.name}</div>
                      {integration.autoSync && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          auto-sync on change
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {integration.projectName} / <strong>{integration.environmentName}</strong>
                    </td>
                    <td className="p-4 text-sm">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {integration.config.ownerSlug}
                      </code>{' '}
                      → {integration.config.contextName}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">{statusBadge(integration)}</div>
                      {integration.lastSyncAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(integration.lastSyncAt).toLocaleString()}
                        </div>
                      )}
                      {integration.lastSyncMessage && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate" title={integration.lastSyncMessage}>
                          {integration.lastSyncMessage}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => syncMutation.mutate(integration.id)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
                        title="Sync now"
                        disabled={syncMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() =>
                          setConfirmState({
                            title: 'Delete Integration',
                            message: `Delete "${integration.name}"?\nSecrets already pushed to CircleCI stay there.`,
                            confirmLabel: 'Delete',
                            danger: true,
                            action: () => deleteMutation.mutate(integration.id),
                          })
                        }
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                        title="Delete integration"
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

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-auto">
              <h2 className="text-xl font-bold mb-4">New CircleCI Integration</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="cacheby-backend → cacheby-prod"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                    <select
                      className="input"
                      value={form.projectId}
                      onChange={(e) => setForm(prev => ({ ...prev, projectId: e.target.value, environmentId: '' }))}
                    >
                      <option value="">Select...</option>
                      {(projects ?? []).map((p: Project) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                    <select
                      className="input"
                      value={form.environmentId}
                      onChange={(e) => setForm(prev => ({ ...prev, environmentId: e.target.value }))}
                      disabled={!form.projectId}
                    >
                      <option value="">Select...</option>
                      {(environments ?? []).map((env: Environment) => (
                        <option key={env.id} value={env.id}>{env.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CircleCI Org Slug</label>
                  <input
                    type="text"
                    className="input font-mono text-sm"
                    value={form.ownerSlug}
                    onChange={(e) => setForm(prev => ({ ...prev, ownerSlug: e.target.value }))}
                    placeholder="gh/datamaker"
                  />
                  <p className="text-xs text-gray-500 mt-1">VCS 접두어 포함 (gh/ 또는 bb/)</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Context Name</label>
                  <input
                    type="text"
                    className="input font-mono text-sm"
                    value={form.contextName}
                    onChange={(e) => setForm(prev => ({ ...prev, contextName: e.target.value }))}
                    placeholder="cacheby-prod"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CircleCI API Token</label>
                  <input
                    type="password"
                    className="input font-mono text-sm"
                    value={form.token}
                    onChange={(e) => setForm(prev => ({ ...prev, token: e.target.value }))}
                    placeholder="CCIPAT_..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    User Settings → Personal API Tokens. 암호화 저장되며 다시 표시되지 않습니다.
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">
                    이 환경의 시크릿이 CircleCI context로 복사됩니다. context에 이미 있는 다른 키는
                    그대로 두고, 같은 키만 덮어씁니다.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowModal(false);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Connecting...' : 'Create & Sync'}
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
