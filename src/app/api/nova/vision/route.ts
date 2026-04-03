import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/nova/logger';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE = process.env.NVIDIA_NIM_BASE || 'https://integrate.api.nvidia.com/v1';
// Best vision model on NIM — swap to 'nvidia/llama-3.2-11b-vision-instruct' for lower latency
const NIM_VISION_MODEL = process.env.NVIDIA_NIM_VISION_MODEL || 'meta/llama-3.2-90b-vision-instruct';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const imageBase64 = formData.get('imageBase64') as string;
    const question = formData.get('question') as string || 'Describe this image in detail.';

    let imageUrl: string;

    if (imageBase64) {
      imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    } else if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imageFile.type || 'image/jpeg';
      imageUrl = `data:${mimeType};base64,${base64}`;
    } else {
      return NextResponse.json({ error: 'Image file or base64 data is required' }, { status: 400 });
    }

    logger.debug('vision', 'Processing image via NVIDIA NIM', { model: NIM_VISION_MODEL, question });

    const response = await fetch(`${NIM_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NIM_API_KEY}`,
      },
      body: JSON.stringify({
        model: NIM_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: question },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('vision', 'NVIDIA NIM vision error', errText);
      throw new Error(`NVIDIA NIM Vision: ${response.status} — ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const duration = Date.now() - startTime;
    logger.info('vision', 'Image processed', { duration: `${duration}ms`, responseLength: content.length });

    return NextResponse.json({ success: true, analysis: content, thinking: null, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('vision', 'Image processing failed', error, { duration: `${duration}ms` });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process image' },
      { status: 500 }
    );
  }
}
