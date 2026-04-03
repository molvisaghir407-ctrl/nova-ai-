import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/nova/logger';

// GET - Retrieve logs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') as 'debug' | 'info' | 'warn' | 'error' | null;
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100');

    const logs = logger.getLogs({
      level: level || undefined,
      category: category || undefined,
      limit,
    });

    return NextResponse.json({ success: true, logs });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve logs' },
      { status: 500 }
    );
  }
}

// DELETE - Clear logs
export async function DELETE() {
  try {
    logger.clearLogs();
    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}

// POST - Export logs
export async function POST(req: NextRequest) {
  try {
    const { format = 'json' } = await req.json();
    
    const exported = logger.exportLogs(format as 'json' | 'csv');
    
    return new NextResponse(exported, {
      status: 200,
      headers: {
        'Content-Type': format === 'json' ? 'application/json' : 'text/csv',
        'Content-Disposition': `attachment; filename="nova-logs-${Date.now()}.${format}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to export logs' },
      { status: 500 }
    );
  }
}
