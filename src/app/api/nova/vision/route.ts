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

// Vision API for image understanding
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const imageBase64 = formData.get('imageBase64') as string;
    const question = formData.get('question') as string || 'Describe this image in detail';
    const enableThinking = formData.get('enableThinking') === 'true';

    let imageUrl: string;

    if (imageBase64) {
      // Use provided base64 data
      imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    } else if (imageFile) {
      // Convert file to base64
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imageFile.type || 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64}`;
    } else {
      return NextResponse.json(
        { error: 'Image file or base64 data is required' },
        { status: 400 }
      );
    }

    const zai = await getZAI();

    logger.debug('vision', 'Processing image', { question, enableThinking });

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      thinking: enableThinking ? { type: 'enabled' } : { type: 'disabled' }
    });

    const content = response.choices[0]?.message?.content || '';
    const thinking = 'thinking' in response && response.thinking ? response.thinking as string : null;

    const duration = Date.now() - startTime;
    logger.info('vision', 'Image processed', { duration: `${duration}ms`, responseLength: content.length });

    return NextResponse.json({
      success: true,
      analysis: content,
      thinking,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('vision', 'Image processing failed', error, { duration: `${duration}ms` });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process image',
      },
      { status: 500 }
    );
  }
}
