import { GoogleGenAI, Type } from "@google/genai";

// NOTE: In a production app, never hardcode API keys on the client. 
// However, per instructions for this demo, we assume the environment variable or a safe context.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Perplexity API integration for doll identification and category suggestion
// Reference: https://docs.perplexity.ai/guides/chat-completions-sdk
// Reference: https://docs.perplexity.ai/guides/structured-outputs

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/v1/chat/completions';

// Helper to convert File to Base64
export const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const cleanJsonText = (text: string): string => {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return cleaned;
};

async function callPerplexity(messages: any[], imageBase64?: string, mimeType?: string, outputSchema?: any) {
  const payload: any = {
    model: 'sonar-pro',
    messages,
    stream: false,
  };
  if (imageBase64 && mimeType) {
    payload.messages[0].content.push({
      type: 'image',
      image: {
        data: imageBase64,
        mime_type: mimeType,
      },
    });
  }
  if (outputSchema) {
    payload.tools = [
      {
        type: 'output_schema',
        schema: outputSchema,
      },
    ];
  }
  const res = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Perplexity API error');
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '{}';
}

export const identifyDoll = async (file: File) => {
  try {
    const base64Data = await fileToBase64(file);
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this doll/plushie image. Return a JSON object with:\n- 'name': A cute, short name.\n- 'description': A very short description.\n- 'size': A string containing "Normal", "Small", or "Normal, Small" based on visual estimation.` },
        ],
      },
    ];
    const outputSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        size: { type: 'string' },
      },
      required: ['name', 'description', 'size'],
    };
    const text = await callPerplexity(messages, base64Data, file.type, outputSchema);
    return JSON.parse(cleanJsonText(text));
  } catch (error) {
    console.error('Perplexity Error:', error);
    return { name: '', description: '', size: 'Normal' };
  }
};

export const suggestCategory = async (file: File) => {
  try {
    const base64Data = await fileToBase64(file);
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Analyze this image. If there is clearly visible text (e.g., a brand name, a tag, or a title on a box), return that text as the category name. If there is no text, identify the type of object (e.g., "Sharks", "Teddy Bears"). Return a JSON object.` },
        ],
      },
    ];
    const outputSchema = {
      type: 'object',
      properties: {
        category: { type: 'string' },
      },
      required: ['category'],
    };
    const text = await callPerplexity(messages, base64Data, file.type, outputSchema);
    const data = JSON.parse(cleanJsonText(text));
    return data.category || 'Misc';
  } catch (error) {
    console.error('Perplexity Error:', error);
    return 'Unknown';
  }
};
