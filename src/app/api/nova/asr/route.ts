import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { logger } from '@/lib/nova/logger';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const audioBase64 = formData.get('audioBase64') as string;

    let base64Data: string;

    if (audioBase64) {
      // Use provided base64 data
      base64Data = audioBase64;
    } else if (audioFile) {
      // Convert file to base64
      const arrayBuffer = await audioFile.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
    } else {
      return NextResponse.json(
        { error: 'Audio file or base64 data is required' },
        { status: 400 }
      );
    }

    const zai = await getZAI();

    logger.debug('asr', 'Processing audio', { base64Length: base64Data.length });

    const response = await zai.audio.asr.create({
      file_base64: base64Data
    });

    const transcription = response.text;

    if (!transcription || transcription.trim().length === 0) {
      return NextResponse.json({
        success: true,
        transcription: '',
        message: 'No speech detected',
      });
    }

    const duration = Date.now() - startTime;
    logger.info('asr', 'Transcription complete', { 
      duration: `${duration}ms`,
      textLength: transcription.length,
      wordCount: transcription.split(/\s+/).length
    });

    return NextResponse.json({
      success: true,
      transcription,
      wordCount: transcription.split(/\s+/).length,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('asr', 'Transcription failed', error, { duration: `${duration}ms` });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to transcribe audio',
      },
      { status: 500 }
    );
  }
}
