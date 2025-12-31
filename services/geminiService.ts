
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateStrongPassword = async (context: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a highly secure, memorable password for a service called "${context}". 
      Return ONLY a JSON object with two fields: 'password' (the generated string) and 'reason' (why it is secure).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            password: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["password", "reason"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini password generation failed:", error);
    return null;
  }
};

export const checkPasswordStrength = async (password: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the security of this password: "${password}". 
      Provide a score from 0-100 and a short tip for improvement.
      Return ONLY a JSON object with 'score' (number) and 'tip' (string).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            tip: { type: Type.STRING }
          },
          required: ["score", "tip"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini strength check failed:", error);
    return null;
  }
};
