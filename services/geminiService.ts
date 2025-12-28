import { GoogleGenAI, Type } from "@google/genai";

// NOTE: In a production app, never hardcode API keys on the client. 
// However, per instructions for this demo, we assume the environment variable or a safe context.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
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
  // Remove Markdown code blocks if present
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return cleaned;
};

export const identifyDoll = async (file: File) => {
  try {
    const base64Data = await fileToGenerativePart(file);
    
    // Using gemini-3-flash-preview for multimodal analysis with JSON schema support
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: `Analyze this doll/plushie image. Return a JSON object with:
            - 'name': A cute, short name.
            - 'description': A very short description.
            - 'size': A string containing "Normal", "Small", or "Normal, Small" based on visual estimation.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                size: { type: Type.STRING }
            },
            required: ["name", "description", "size"]
        }
      }
    });

    const text = response.text || '{}';
    return JSON.parse(cleanJsonText(text));
  } catch (error) {
    console.error("Gemini Error:", error);
    // Return a fallback object so the UI doesn't crash with [object Object]
    return { name: '', description: '', size: 'Normal' };
  }
};

export const suggestCategory = async (file: File) => {
  try {
    const base64Data = await fileToGenerativePart(file);
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data
              }
            },
            {
              text: `Analyze this image. If there is clearly visible text (e.g., a brand name, a tag, or a title on a box), return that text as the category name. If there is no text, identify the type of object (e.g., "Sharks", "Teddy Bears"). Return a JSON object.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING }
            },
            required: ["category"]
          }
        }
      });
  
      const text = response.text || '{}';
      const data = JSON.parse(cleanJsonText(text));
      return data.category || "Misc";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Unknown";
  }
};
