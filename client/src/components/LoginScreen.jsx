import { useState } from 'react';
import { Monitor, Lock, ShieldCheck } from 'lucide-react';
import { login } from '../api';

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(password, needsTotp ? totpCode : undefined);
      if (result.totp_required) {
        setNeedsTotp(true);
        setLoading(false);
        return;
      }
      onLogin();
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="text-center mb-6">
          <Monitor size={48} style={{ color: 'var(--accent)' }} className="mx-auto mb-3" />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>RigBoard</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!needsTotp ? (
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" autoFocus
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          ) : (
            <div>
              <p className="text-sm mb-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                Enter the 6-digit code from your authenticator app
              </p>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" autoFocus maxLength={6}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm text-center font-mono tracking-widest text-lg"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg font-medium text-white text-sm"
            style={{ backgroundColor: 'var(--accent)', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : needsTotp ? 'Verify' : 'Sign In'}
          </button>
          {needsTotp && (
            <button type="button" onClick={() => { setNeedsTotp(false); setTotpCode(''); setError(''); }}
              className="w-full py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Back to password
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
