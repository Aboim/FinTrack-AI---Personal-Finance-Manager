
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getFinancialInsights = async (transactions: Transaction[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const summary = transactions.slice(0, 50).map(t => ({
    type: t.type,
    amount: t.amount,
    category: t.category,
    date: t.date
  }));

  const prompt = `
    Analyze these latest financial transactions and provide 3-4 concise, professional bullet points of advice or observations about the spending habits. 
    Focus on areas of improvement, trends, or positive signs.
    Transactions: ${JSON.stringify(summary)}
    Keep the tone helpful and modern.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No insights available at the moment.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Could not generate AI insights. Check your API configuration.";
  }
};
