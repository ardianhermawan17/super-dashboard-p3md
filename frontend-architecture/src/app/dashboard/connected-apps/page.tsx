import ConnectedAppsPage from '@/features/connected-apps/components/connected-apps-page';

export const metadata = {
  title: 'Dashboard: Connected Apps',
  description: 'Manage external OAuth 2.1 applications and MCP agents authorized to access your P3MD account.',
};

export default function Page() {
  return <ConnectedAppsPage />;
}
