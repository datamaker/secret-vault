import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Key, Eye, Copy, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { decryptShare } from '../lib/shareCrypto';
import { revealShareLink } from '../api/share';

// 공개 페이지 — 로그인 없이 링크만으로 접근한다
export function ShareView() {
  const { shareId } = useParams<{ shareId: string }>();
  const [secret, setSecret] = useState<string | null>(null);
  const [remainingViews, setRemainingViews] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReveal = async () => {
    const key = window.location.hash.slice(1);
    if (!key) {
      setError('This link is missing its decryption key. Ask the sender for the full link.');
      return;
    }
    setLoading(true);
    try {
      const { ciphertext, iv, remainingViews } = await revealShareLink(shareId!);
      const plaintext = await decryptShare(ciphertext, iv, key);
      setSecret(plaintext);
      setRemainingViews(remainingViews);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e.response?.status === 410 || e.response?.status === 404) {
        setError('This link has expired or reached its view limit.');
      } else {
        setError('Failed to decrypt. The link may be corrupted.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-xl">
        <div className="flex items-center gap-2 text-xl font-bold mb-6">
          <Key className="w-6 h-6 text-primary-600" />
          Secret Vault — Shared Secret
        </div>

        {error ? (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : secret !== null ? (
          <>
            <pre className="text-sm bg-gray-100 p-4 rounded mb-4 whitespace-pre-wrap break-all max-h-96 overflow-auto">
              {secret}
            </pre>
            {remainingViews !== null && (
              <p className="text-xs text-gray-500 mb-4">
                {remainingViews === 0
                  ? 'This was the last view — the link is now destroyed.'
                  : `${remainingViews} view(s) remaining.`}
              </p>
            )}
            <button onClick={copySecret} className="btn btn-primary flex items-center gap-2">
              <Copy className="w-4 h-4" />
              Copy Secret
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Someone shared a secret with you. Revealing it may consume one of its limited views.
            </p>
            <button
              onClick={handleReveal}
              className="btn btn-primary flex items-center gap-2"
              disabled={loading}
            >
              <Eye className="w-4 h-4" />
              {loading ? 'Decrypting...' : 'Reveal Secret'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
