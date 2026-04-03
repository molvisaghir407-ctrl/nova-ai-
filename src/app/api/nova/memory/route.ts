import { NextRequest, NextResponse } from 'next/server';
import { memoryManager } from '@/lib/nova/memory';
import { logger } from '@/lib/nova/logger';
import { db } from '@/lib/db';

// GET - Retrieve memories
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const query = searchParams.get('query');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    switch (action) {
      case 'recall':
        if (!query) {
          return NextResponse.json(
            { error: 'Query is required for recall action' },
            { status: 400 }
          );
        }
        const recalled = await memoryManager.recall(query, { category: category || undefined, limit });
        return NextResponse.json({ success: true, results: recalled });

      case 'category':
        if (!category) {
          return NextResponse.json(
            { error: 'Category is required for category action' },
            { status: 400 }
          );
        }
        const byCategory = await memoryManager.getByCategory(category);
        return NextResponse.json({ success: true, memories: byCategory });

      case 'stats':
        const stats = await memoryManager.getStats();
        return NextResponse.json({ success: true, stats });

      default:
        // List all memories
        const memories = await db.memory.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return NextResponse.json({
          success: true,
          memories: memories.map(m => ({
            id: m.id,
            category: m.category,
            content: m.content,
            importance: m.importance,
            metadata: m.metadata ? JSON.parse(m.metadata) : null,
            accessedAt: m.accessedAt,
            accessCount: m.accessCount,
            createdAt: m.createdAt,
          })),
        });
    }
  } catch (error) {
    logger.error('memory', 'Failed to retrieve memories', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve memories' },
      { status: 500 }
    );
  }
}

// POST - Store new memory
export async function POST(req: NextRequest) {
  try {
    const { category, content, importance = 0.5, metadata } = await req.json();

    if (!category || !content) {
      return NextResponse.json(
        { error: 'Category and content are required' },
        { status: 400 }
      );
    }

    const validCategories = ['fact', 'preference', 'conversation', 'note', 'skill'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const entry = await memoryManager.store(category, content, importance, metadata);

    logger.info('memory', 'Memory stored', { id: entry.id, category });

    return NextResponse.json({ success: true, memory: entry });
  } catch (error) {
    logger.error('memory', 'Failed to store memory', error);
    return NextResponse.json(
      { success: false, error: 'Failed to store memory' },
      { status: 500 }
    );
  }
}

// PUT - Update memory
export async function PUT(req: NextRequest) {
  try {
    const { id, content, importance, metadata } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    const updated = await memoryManager.update(id, { content, importance, metadata });

    if (!updated) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, memory: updated });
  } catch (error) {
    logger.error('memory', 'Failed to update memory', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update memory' },
      { status: 500 }
    );
  }
}

// DELETE - Remove memory
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Memory ID is required' },
        { status: 400 }
      );
    }

    const deleted = await memoryManager.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Memory deleted' });
  } catch (error) {
    logger.error('memory', 'Failed to delete memory', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete memory' },
      { status: 500 }
    );
  }
}
