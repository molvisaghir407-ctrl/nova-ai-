import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/nova/logger';

const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY!;
const NIM_BASE = process.env.NVIDIA_NIM_BASE || 'https://integrate.api.nvidia.com/v1';
const DEFAULT_IMAGE_MODEL = process.env.NVIDIA_NIM_IMAGE_MODEL || 'black-forest-labs/flux-dev';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { prompt, model = DEFAULT_IMAGE_MODEL, width = 1024, height = 1024, steps = 20, cfgScale = 7, seed, negativePrompt, numImages = 1 } = await req.json();
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    logger.info('imagine', 'Generating image via NVIDIA NIM', { model, width, height });
    const payload: Record<string, any> = { model, prompt, n: Math.min(numImages, 4), size: `${width}x${height}`, response_format: 'b64_json', num_inference_steps: steps, guidance_scale: cfgScale };
    if (negativePrompt) payload.negative_prompt = negativePrompt;
    if (seed !== undefined) payload.seed = seed;

    const response = await fetch(`${NIM_BASE}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${NIM_API_KEY}` },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('imagine', 'NVIDIA NIM image error', errText);
      throw new Error(`NVIDIA NIM: ${response.status} — ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const images = (data.data || []).map((img: any) => ({ b64: img.b64_json, url: img.url || null, revisedPrompt: img.revised_prompt || prompt }));
    const duration = Date.now() - startTime;
    logger.info('imagine', 'Image generated', { duration: `${duration}ms`, count: images.length });
    return NextResponse.json({ success: true, images, model, prompt, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('imagine', 'Image generation failed', error, { duration: `${duration}ms` });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    models: [
      { id: 'black-forest-labs/flux-dev', name: 'FLUX Dev', description: 'Best quality ~15s' },
      { id: 'black-forest-labs/flux-schnell', name: 'FLUX Schnell', description: 'Fast ~5s' },
      { id: 'stabilityai/stable-diffusion-xl', name: 'SDXL', description: 'Classic SDXL' },
    ],
    defaultModel: DEFAULT_IMAGE_MODEL,
  });
}
