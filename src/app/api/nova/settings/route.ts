import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/nova/logger';

let _db: any = null;
async function getDb() {
  if (_db) return _db;
  try { const { db } = await import('@/lib/db'); _db = db; return _db; } catch { return null; }
}

const DEFAULTS = {
  id: 'nova-settings', wakeWord: 'Hey Nova', voiceEnabled: true, ttsEnabled: true,
  ttsSpeed: 1.0, ttsVoice: 'default', theme: 'dark', language: 'en-US',
  proactiveEnabled: true, offlineMode: false, logLevel: 'info', safetyLevel: 'balanced',
};

export async function GET() {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ success: true, settings: DEFAULTS });
    let settings = await db.settings.findUnique({ where: { id: 'nova-settings' } });
    if (!settings) {
      settings = await db.settings.create({ data: DEFAULTS });
    }
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    logger.error('settings', 'Failed to retrieve settings', error);
    return NextResponse.json({ success: true, settings: DEFAULTS });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const body = await req.json();
    const allowedFields = ['wakeWord', 'voiceEnabled', 'ttsEnabled', 'ttsSpeed', 'ttsVoice', 'theme', 'language', 'proactiveEnabled', 'offlineMode', 'logLevel', 'safetyLevel'];
    const data: Record<string, any> = {};
    for (const key of allowedFields) { if (key in body) data[key] = body[key]; }
    const settings = await db.settings.upsert({
      where: { id: 'nova-settings' },
      create: { ...DEFAULTS, ...data },
      update: data,
    });
    logger.info('settings', 'Settings updated');
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    logger.error('settings', 'Failed to update settings', error);
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
  }
}
