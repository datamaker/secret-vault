import { useState } from 'react';
import { Send, Copy, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyText } from '../lib/clipboard';
import { Layout } from '../components/layout/Layout';
import { encryptForShare } from '../lib/shareCrypto';
import { createShareLink } from '../api/share';

export function ShareSecret() {
  const [content, setContent] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [maxViews, setMaxViews] = useState('1');
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Enter the secret to share');
      return;
    }
    setCreating(true);
    try {
      const { ciphertext, iv, key } = await encryptForShare(content);
      const { id } = await createShareLink(
        ciphertext,
        iv,
        Number(expiresInHours),
        maxViews === 'unlimited' ? null : Number(maxViews)
      );
      // 복호화 키는 fragment(#)에만 존재 — 서버로 전송되지 않는다
      setCreatedLink(`${window.location.origin}/share/${id}#${key}`);
      setContent('');
    } catch {
      toast.error('Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!createdLink) return;
    (await copyText(createdLink)) ? toast.success('Link copied to clipboard') : toast.error('Copy failed');
  };

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Share Secret</h1>
          <p className="text-sm text-gray-500 mt-1">
            Share a secret with an end-to-end encrypted link. The decryption key stays in the URL
            fragment and never reaches the server.
          </p>
        </div>

        {createdLink ? (
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-2">Link Created</h2>
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Anyone with this link can read the secret until it expires or hits the view limit.
                Share it over a trusted channel.
              </p>
            </div>
            <div className="flex items-center gap-2 mb-6">
              <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded break-all">
                {createdLink}
              </code>
              <button onClick={copyLink} className="btn btn-secondary flex items-center gap-2 shrink-0">
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => setCreatedLink(null)}>
              Share Another Secret
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="card p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret</label>
              <textarea
                className="input font-mono"
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste the secret, credential, or config to share"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires in</label>
                <select
                  className="input"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                >
                  <option value="1">1 hour</option>
                  <option value="24">1 day</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">View limit</label>
                <select
                  className="input"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                >
                  <option value="1">1 view (burn after reading)</option>
                  <option value="5">5 views</option>
                  <option value="20">20 views</option>
                  <option value="unlimited">Unlimited (until expiry)</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={creating}>
              <Send className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create Share Link'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
