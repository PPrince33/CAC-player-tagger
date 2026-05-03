'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const router  = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);

    if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return; }

    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.replace('/matches');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-white">Create Account</h1>
        <p className="mb-6 text-sm text-gray-400">Join CAC Tagger</p>

        {error && (
          <div className="mb-4 rounded border border-red-600 bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Username</label>
            <input
              type="text" required value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Email</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Password</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
          >
            <UserPlus size={16} />
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-green-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
