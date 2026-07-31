import { useQuery } from '@tanstack/react-query';
import { ListOrdered, Plus, Pencil, Trash2, FolderOpen, UserPlus, UserMinus, Shield, KeyRound, Fingerprint, Cloud, RefreshCw } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useWorkspaceStore } from '../store/workspaceStore';
import { getTeamActivity, ActivityEntry } from '../api/activity';

const actionIcons: Record<string, React.ReactNode> = {
  'secret.created': <Plus className="w-4 h-4 text-green-600" />,
  'secret.updated': <Pencil className="w-4 h-4 text-blue-600" />,
  'secret.deleted': <Trash2 className="w-4 h-4 text-red-600" />,
  'project.created': <FolderOpen className="w-4 h-4 text-green-600" />,
  'project.deleted': <FolderOpen className="w-4 h-4 text-red-600" />,
  'team.member_added': <UserPlus className="w-4 h-4 text-green-600" />,
  'team.member_removed': <UserMinus className="w-4 h-4 text-red-600" />,
  'team.member_role_changed': <Shield className="w-4 h-4 text-blue-600" />,
  'api_token.created': <KeyRound className="w-4 h-4 text-green-600" />,
  'api_token.revoked': <KeyRound className="w-4 h-4 text-red-600" />,
  'credential.created': <Fingerprint className="w-4 h-4 text-green-600" />,
  'credential.updated': <Fingerprint className="w-4 h-4 text-blue-600" />,
  'credential.deleted': <Fingerprint className="w-4 h-4 text-red-600" />,
  'integration.created': <Cloud className="w-4 h-4 text-green-600" />,
  'integration.deleted': <Cloud className="w-4 h-4 text-red-600" />,
  'integration.synced': <RefreshCw className="w-4 h-4 text-blue-600" />,
};

// 자동 싱크처럼 사용자가 없는 이벤트는 "Unknown" 대신 주체를 명확히 표시한다
const actorOf = (entry: ActivityEntry): string => {
  if (entry.userName || entry.userEmail) return entry.userName || entry.userEmail!;
  if (entry.details?.trigger === 'auto') return 'Auto-sync';
  return 'Unknown';
};

const describe = (entry: ActivityEntry): React.ReactNode => {
  const d = entry.details ?? {};
  const key = <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{String(d.key ?? '')}</code>;
  const scope = (
    <>
      in <span className="font-medium">{String(d.environment ?? '')}</span> of{' '}
      <span className="font-medium">{String(d.project ?? '')}</span>
    </>
  );

  switch (entry.action) {
    case 'secret.created':
      return <>added {key} {scope}</>;
    case 'secret.updated':
      return <>updated {key} {scope}</>;
    case 'secret.deleted':
      return <>deleted {key} {scope}</>;
    case 'project.created':
      return <>created project <span className="font-medium">{String(d.project ?? '')}</span></>;
    case 'project.deleted':
      return <>deleted project <span className="font-medium">{String(d.project ?? '')}</span></>;
    case 'team.member_added':
      return d.invited
        ? <>invited <span className="font-medium">{String(d.email ?? '')}</span> as {String(d.role ?? '')}</>
        : <>added <span className="font-medium">{String(d.email ?? '')}</span> as {String(d.role ?? '')}</>;
    case 'team.member_removed':
      return <>removed a member from the team</>;
    case 'team.member_role_changed':
      return <>changed a member's role to <span className="font-medium">{String(d.role ?? '')}</span></>;
    case 'api_token.created':
      return <>created {String(d.scope ?? '')} API key <span className="font-medium">"{String(d.name ?? '')}"</span></>;
    case 'api_token.revoked':
      return <>revoked an API key</>;
    case 'credential.created':
      return <>added credential <span className="font-medium">{String(d.name ?? '')}</span></>;
    case 'credential.updated':
      return <>updated credential <span className="font-medium">{String(d.name ?? '')}</span></>;
    case 'credential.deleted':
      return <>deleted credential <span className="font-medium">{String(d.name ?? '')}</span></>;
    case 'integration.created':
      return <>connected integration <span className="font-medium">{String(d.name ?? '')}</span> to {String(d.target ?? '')}</>;
    case 'integration.deleted':
      return <>removed integration <span className="font-medium">{String(d.name ?? '')}</span></>;
    case 'integration.synced':
      return (
        <>
          synced <span className="font-medium">{String(d.synced ?? 0)}</span> secrets via{' '}
          <span className="font-medium">{String(d.name ?? '')}</span>
          {Number(d.failed ?? 0) > 0 && <span className="text-red-600"> ({String(d.failed)} failed)</span>}
        </>
      );
    default:
      return <>{entry.action}</>;
  }
};

export function Activity() {
  const { teamId } = useWorkspaceStore();

  const { data: activity, isLoading } = useQuery({
    queryKey: ['team-activity', teamId],
    queryFn: () => getTeamActivity(teamId!),
    enabled: !!teamId,
    refetchInterval: 30_000,
  });

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Get a basic overview of your team's actions.</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : !activity || activity.length === 0 ? (
          <div className="text-center py-12">
            <ListOrdered className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
            <p className="text-gray-500">Team actions (secrets, projects, members, tokens) will show up here.</p>
          </div>
        ) : (
          <div className="card divide-y">
            {activity.map((entry: ActivityEntry) => (
              <div key={entry.id} className="p-4 flex items-start gap-3">
                <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                  {actionIcons[entry.action] ?? <ListOrdered className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{actorOf(entry)}</span> {describe(entry)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
