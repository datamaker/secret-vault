import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, EyeOff, Trash2, ArrowLeft, Download, Upload, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Layout } from '../components/layout/Layout';
import { getProject, getEnvironments, Environment } from '../api/projects';
import { getSecrets, createSecret, deleteSecret, exportSecrets, Secret } from '../api/secrets';

export function Secrets() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [newSecret, setNewSecret] = useState({ key: '', value: '', description: '' });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: environments } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => getEnvironments(projectId!),
    enabled: !!projectId,
    select: (data) => {
      if (data.length > 0 && !selectedEnv) {
        setSelectedEnv(data[0].id);
      }
      return data;
    },
  });

  const { data: secrets, isLoading } = useQuery({
    queryKey: ['secrets', selectedEnv],
    queryFn: () => getSecrets(selectedEnv!, true),
    enabled: !!selectedEnv,
  });

  const createSecretMutation = useMutation({
    mutationFn: () => createSecret(selectedEnv!, newSecret.key, newSecret.value, newSecret.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets', selectedEnv] });
      setShowCreateModal(false);
      setNewSecret({ key: '', value: '', description: '' });
      toast.success('Secret created successfully');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create secret');
    },
  });

  const deleteSecretMutation = useMutation({
    mutationFn: (key: string) => deleteSecret(selectedEnv!, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secrets', selectedEnv] });
      toast.success('Secret deleted');
    },
    onError: () => {
      toast.error('Failed to delete secret');
    },
  });

  const handleExport = async () => {
    if (!selectedEnv) return;
    try {
      const content = await exportSecrets(selectedEnv);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.env';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Secrets exported');
    } catch {
      toast.error('Failed to export secrets');
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  const handleCreateSecret = (e: React.FormEvent) => {
    e.preventDefault();
    createSecretMutation.mutate();
  };

  const currentEnv = environments?.find((e: Environment) => e.id === selectedEnv);

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <Link to={`/teams/${project?.teamId}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Team
          </Link>
          <h1 className="text-2xl font-bold">{project?.name || 'Loading...'}</h1>
        </div>

        {/* Environment Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b">
          {environments?.map((env: Environment) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnv(env.id)}
              className={`px-4 py-2 border-b-2 transition-colors ${
                selectedEnv === env.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: env.color }}
              />
              {env.name}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            {currentEnv && (
              <span>
                Showing secrets for <strong>{currentEnv.name}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="btn btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="btn btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Secret
            </button>
          </div>
        </div>

        {/* Secrets Table */}
        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : secrets?.length === 0 ? (
          <div className="text-center py-12 card">
            <p className="text-gray-500 mb-4">No secrets in this environment</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Add Your First Secret
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Key</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Value</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Description</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {secrets?.map((secret: Secret) => (
                  <tr key={secret.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{secret.key}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded max-w-xs truncate">
                          {showValues[secret.id] ? secret.value : '••••••••'}
                        </code>
                        <button
                          onClick={() => setShowValues(prev => ({ ...prev, [secret.id]: !prev[secret.id] }))}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {showValues[secret.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(secret.value || '')}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{secret.description || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Delete this secret?')) {
                            deleteSecretMutation.mutate(secret.key);
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
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

        {/* Create Secret Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add New Secret</h2>
              <form onSubmit={handleCreateSecret}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={newSecret.key}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                    placeholder="API_KEY"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">Uppercase letters, numbers, and underscores only</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <textarea
                    className="input font-mono"
                    rows={3}
                    value={newSecret.value}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="secret-value-here"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={newSecret.description}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What this secret is for"
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
                    disabled={createSecretMutation.isPending}
                  >
                    {createSecretMutation.isPending ? 'Creating...' : 'Create'}
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
