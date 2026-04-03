import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/nova/logger';

let _db: any = null;
async function getDb() {
  if (_db) return _db;
  try { const { db } = await import('@/lib/db'); _db = db; return _db; } catch { return null; }
}

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ success: true, tasks: [] });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const where: Record<string, unknown> = {};
    if (status && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) where.status = status;
    const tasks = await db.task.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: limit });
    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    logger.error('tasks', 'Failed to retrieve tasks', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const { title, description, priority = 5, dueDate } = await req.json();
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    const task = await db.task.create({ data: { title, description, priority: Math.max(1, Math.min(10, priority)), dueDate: dueDate ? new Date(dueDate) : null } });
    logger.info('tasks', 'Task created', { id: task.id });
    return NextResponse.json({ success: true, task });
  } catch (error) {
    logger.error('tasks', 'Failed to create task', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const { id, status, title, description, priority, dueDate } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const data: Record<string, any> = {};
    if (status) data.status = status;
    if (title) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (status === 'completed') data.completedAt = new Date();
    const task = await db.task.update({ where: { id }, data });
    return NextResponse.json({ success: true, task });
  } catch (error) {
    logger.error('tasks', 'Failed to update task', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('tasks', 'Failed to delete task', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
