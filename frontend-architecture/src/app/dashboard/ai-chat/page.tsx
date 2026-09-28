import { AiChatInterface } from '@/features/ai-chat/components/ai-chat-interface';

export const metadata = {
  title: 'Dashboard: AI Assistant',
  description: 'In-app AI assistant grounded on your P3MD boards, calendar, activity, and finance data.',
};

export default function Page() {
  return <AiChatInterface />;
}
