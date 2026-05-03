'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, PlusCircle, Shield, BarChart2, LogOut, Tag } from 'lucide-react';

const NAV = [
  { href: '/matches',        label: 'My Matches',  icon: LayoutDashboard },
  { href: '/matches/create', label: 'Create Match', icon: PlusCircle },
  { href: '/analytics',      label: 'Analytics',    icon: BarChart2 },
  { href: '/admin',          label: 'Admin',        icon: Shield, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('username,role').eq('id', user.id).single();
      setProfile(data);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const isAdmin = profile?.role === 'super_admin';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-52 flex-col bg-black border-r-2 border-black">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b-2 border-[#34D399] px-4">
        <Tag className="text-[#34D399]" size={18} />
        <span className="text-sm font-bold text-white tracking-widest">CAC TAGGER</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map(({ href, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 border-2 px-3 py-2 text-xs font-bold uppercase transition-none ${
                active
                  ? 'bg-[#34D399] border-[#34D399] text-black'
                  : 'bg-black border-black text-white hover:bg-[#34D399] hover:text-black hover:border-[#34D399]'
              }`}>
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Sign out */}
      <div className="border-t-2 border-gray-700 p-3">
        {profile && (
          <div className="mb-2 text-xs text-gray-400 truncate font-mono">
            {profile.username}
            {isAdmin && (
              <span className="ml-1 bg-[#FACC15] text-black px-1 py-0.5 text-[10px] font-bold">
                ADMIN
              </span>
            )}
          </div>
        )}
        <button onClick={signOut}
          className="flex w-full items-center gap-2 border-2 border-gray-700 px-3 py-1.5 text-xs font-bold uppercase text-gray-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-none">
          <LogOut size={12} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
