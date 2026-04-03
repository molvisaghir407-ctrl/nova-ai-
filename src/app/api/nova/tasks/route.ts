import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/nova/logger';

// GET - Retrieve tasks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      where.status = status;
    }

    const tasks = await db.task.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    logger.error('tasks', 'Failed to retrieve tasks', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve tasks' },
      { status: 500 }
    );
  }
}

// POST - Create new task
export async function POST(req: NextRequest) {
  try {
    const { title, description, priority = 5, dueDate } = await req.json();

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const task = await db.task.create({
      data: {
        title,
        description,
        priority: Math.max(1, Math.min(10, priority)),
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    logger.info('tasks', 'Task created', { id: task.id, title });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    logger.error('tasks', 'Failed to create task', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// PUT - Update task
export async function PUT(req: NextRequest) {
  try {
    const { id, title, description, status, priority, dueDate } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = Math.max(1, Math.min(10, priority));
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status === 'completed') updateData.completedAt = new Date();

    const task = await db.task.update({
      where: { id },
      data: updateData,
    });

    logger.info('tasks', 'Task updated', { id: task.id, updates: Object.keys(updateData) });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    logger.error('tasks', 'Failed to update task', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE - Remove task
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    await db.task.delete({ where: { id } });

    logger.info('tasks', 'Task deleted', { id });

    return NextResponse.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    logger.error('tasks', 'Failed to delete task', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
