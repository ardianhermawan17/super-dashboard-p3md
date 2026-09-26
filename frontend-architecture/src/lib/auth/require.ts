import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getSession } from './session';

export async function requirePermission(key: string) {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');
  if (!session.permissions.includes(key)) notFound();
  return session;
}

export async function requireAnyPermission(keys: string[]) {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');
  if (!keys.some((k) => session.permissions.includes(k))) notFound();
  return session;
}
