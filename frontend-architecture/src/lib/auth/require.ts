import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getSession } from './session';

export async function requirePermission(key: string) {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');
  if (!session.permissions.includes(key)) notFound();
  return session;
}
