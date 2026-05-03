import AuthGuard from '@/components/AuthGuard';
import Sidebar   from '@/components/Sidebar';

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="ml-52 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
