'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, LogIn, Tag } from 'lucide-react';

export default function LoginPage() {
  const router  = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.replace('/matches');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-black shadow-brutal-sm">
            <Tag className="text-[#34D399]" size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-black tracking-widest">CAC TAGGER</h1>
            <p className="text-xs text-gray-500">Sign in to your account</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 border-2 border-red-500 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="nb-label">Email</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="nb-input"
            />
          </div>

          <div>
            <label className="nb-label">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required value={password}
                onChange={e => setPassword(e.target.value)}
                className="nb-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="nb-btn-green flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={16} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-600">
          No account?{' '}
          <Link href="/register" className="font-bold text-black underline hover:text-[#34D399]">Register</Link>
        </p>
      </div>
    </div>
  );
}
