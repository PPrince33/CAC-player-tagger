'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, PlusCircle, Shield, BarChart2, LogOut, Tag,
} from 'lucide-react';

const NAV = [
  { href: '/matches',          label: 'My Matches',   icon: LayoutDashboard },
  { href: '/matches/create',   label: 'Create Match',  icon: PlusCircle },
  { href: '/analytics',        label: 'Analytics',     icon: BarChart2 },
  { href: '/admin',            label: 'Admin',         icon: Shield, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles').select('username,role').eq('id', user.id).single();
      setProfile(data);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const isAdmin = profile?.role === 'super_admin';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-52 flex-col border-r border-gray-800 bg-gray-900">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-800 px-4">
        <Tag className="text-green-400" size={20} />
        <span className="text-sm font-bold text-white">CAC Tagger</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map(({ href, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href} href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Sign out */}
      <div className="border-t border-gray-800 p-3">
        {profile && (
          <div className="mb-2 truncate text-xs text-gray-500">
            {profile.username}
            {isAdmin && (
              <span className="ml-1 rounded bg-yellow-800 px-1 text-yellow-300 text-[10px]">
                ADMIN
              </span>
            )}
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-red-400"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
