'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart2, Activity, Layers, Trophy } from 'lucide-react';

export default function AnalyticsPage() {
  const [events,   setEvents]   = useState([]);
  const [matches,  setMatches]  = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: evs }, { data: mats }, { data: profs }] = await Promise.all([
        supabase.from('match_events').select('match_event_id,action,created_at,analyst_id').limit(5000),
        supabase.from('matches').select('match_id,status,created_at'),
        supabase.from('profiles').select('id,username'),
      ]);
      setEvents(evs ?? []);
      setMatches(mats ?? []);
      setAnalysts(profs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const today    = new Date().toISOString().slice(0, 10);
    const todayEvs = events.filter(e => e.created_at?.slice(0, 10) === today);
    const doneMatches = matches.filter(m => m.status === 'Done');
    return {
      totalMatches:  matches.length,
      doneMatches:   doneMatches.length,
      totalEvents:   events.length,
      todayEvents:   todayEvs.length,
      avgPerMatch:   matches.length ? (events.length / matches.length).toFixed(1) : 0,
    };
  }, [events, matches]);

  const actionBreakdown = useMemo(() => {
    const counts = {};
    events.forEach(e => { counts[e.action] = (counts[e.action] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [events]);

  const daily = useMemo(() => {
    const map = {};
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      map[d] = 0;
    }
    events.forEach(e => {
      const d = e.created_at?.slice(0, 10);
      if (d && d in map) map[d]++;
    });
    return Object.entries(map);
  }, [events]);

  const leaderboard = useMemo(() => {
    const counts = {};
    events.forEach(e => { counts[e.analyst_id] = (counts[e.analyst_id] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([id, n]) => ({ name: analysts.find(a => a.id === id)?.username ?? id.slice(0,8), n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [events, analysts]);

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <div className="h-8 w-8 animate-spin border-4 border-black border-t-[#34D399]" />
    </div>
  );

  const maxDaily  = Math.max(...daily.map(([,v]) => v), 1);
  const maxAction = actionBreakdown[0]?.[1] ?? 1;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-black">Analytics</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard icon={<Layers size={20} />}   label="Total Matches"  value={stats.totalMatches} sub={`${stats.doneMatches} done`} />
        <KPICard icon={<Activity size={20} />}  label="Total Events"   value={stats.totalEvents.toLocaleString()} />
        <KPICard icon={<BarChart2 size={20} />} label="Today's Events" value={stats.todayEvents} />
        <KPICard icon={<Trophy size={20} />}    label="Avg / Match"    value={stats.avgPerMatch} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily chart */}
        <div className="nb-card p-4">
          <h2 className="nb-section-title">Events — Last 30 Days</h2>
          <div className="flex items-end gap-0.5 h-32">
            {daily.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-0.5" title={`${date}: ${count}`}>
                <div
                  className="w-full bg-[#34D399] border border-black"
                  style={{ height: `${(count / maxDaily) * 100}%`, minHeight: count ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>{daily[0]?.[0]?.slice(5)}</span>
            <span>{daily[daily.length - 1]?.[0]?.slice(5)}</span>
          </div>
        </div>

        {/* Action breakdown */}
        <div className="nb-card p-4">
          <h2 className="nb-section-title">Top Actions</h2>
          <div className="space-y-1.5">
            {actionBreakdown.map(([action, count]) => (
              <div key={action} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs font-bold text-black">{action}</span>
                <div className="flex-1 border border-black h-3 bg-[#F9FAFB]">
                  <div className="h-full bg-[#FACC15]"
                    style={{ width: `${(count / maxAction) * 100}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-bold text-black">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analyst leaderboard */}
      <div className="nb-card p-4">
        <h2 className="nb-section-title">Analyst Leaderboard</h2>
        <table className="tagger-table w-full border-collapse text-left">
          <thead>
            <tr>
              <th>#</th>
              <th>Analyst</th>
              <th className="text-right">Events Tagged</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(({ name, n }, i) => (
              <tr key={name}>
                <td className="text-gray-500">{i + 1}</td>
                <td className="font-bold text-black">{name}</td>
                <td className="text-right font-bold">{n.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, sub }) {
  return (
    <div className="nb-card p-4">
      <div className="mb-2 text-black">{icon}</div>
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-black">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
