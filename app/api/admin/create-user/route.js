import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { username, email, password, role } = await req.json();

  // Use service-role key (server only) to bypass RLS for admin user creation
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, role },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).single();
  return NextResponse.json({ profile }, { status: 201 });
}
