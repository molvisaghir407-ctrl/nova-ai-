import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/kv-sessions';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default';
  const conversations = await sessionStore.getConversations(userId);
  return NextResponse.json({ success: true, conversations });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'default';
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  await sessionStore.deleteConversation(userId, sessionId);
  return NextResponse.json({ success: true });
}
