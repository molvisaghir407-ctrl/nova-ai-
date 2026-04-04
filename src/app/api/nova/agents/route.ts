import { NextRequest, NextResponse } from 'next/server';
import { listAgents, getAgentById, selectAgent } from '@/lib/nova/agents/registry';
import { classifyIntent } from '@/lib/nova/rag/intent';

// GET /api/nova/agents — list all agents or get one by id
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const detect = searchParams.get('detect'); // detect best agent for a message

  if (id) {
    const agent = getAgentById(id);
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    return NextResponse.json({ success: true, agent });
  }

  if (detect) {
    const intent = classifyIntent(detect);
    const agent = selectAgent(detect, intent);
    return NextResponse.json({ success: true, agent: { id: agent.id, name: agent.name, role: agent.role, model: agent.model } });
  }

  return NextResponse.json({ success: true, agents: listAgents() });
}
