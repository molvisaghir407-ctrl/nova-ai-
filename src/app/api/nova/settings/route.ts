import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/nova/logger';

// GET - Retrieve settings
export async function GET() {
  try {
    let settings = await db.settings.findUnique({ where: { id: 'nova-settings' } });
    
    // Create default settings if not exist
    if (!settings) {
      settings = await db.settings.create({
        data: {
          id: 'nova-settings',
          wakeWord: 'Hey Nova',
          voiceEnabled: true,
          ttsEnabled: true,
          ttsSpeed: 1.0,
          ttsVoice: 'tongtong',
          theme: 'dark',
          language: 'en-US',
          proactiveEnabled: true,
          offlineMode: false,
          logLevel: 'info',
        },
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    logger.error('settings', 'Failed to retrieve settings', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// PUT - Update settings
export async function PUT(req: NextRequest) {
  try {
    const updates = await req.json();

    // Validate settings
    const validSettings = [
      'wakeWord', 'voiceEnabled', 'ttsEnabled', 'ttsSpeed', 'ttsVoice',
      'theme', 'language', 'proactiveEnabled', 'offlineMode', 'logLevel'
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (validSettings.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid settings to update' },
        { status: 400 }
      );
    }

    // Update or create settings
    const settings = await db.settings.upsert({
      where: { id: 'nova-settings' },
      create: {
        id: 'nova-settings',
        ...filteredUpdates,
      },
      update: filteredUpdates,
    });

    logger.info('settings', 'Settings updated', { keys: Object.keys(filteredUpdates) });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    logger.error('settings', 'Failed to update settings', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
