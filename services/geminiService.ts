
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getFinancialInsights = async (transactions: Transaction[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summary = transactions.slice(0, 50).map(t => ({
    type: t.type,
    amount: t.amount,
    category: t.category,
    date: t.date
  }));

  const prompt = `
    Analise estas transações financeiras recentes (valores em Euros €) e forneça de 3 a 4 tópicos (bullet points) concisos e profissionais com conselhos ou observações sobre os hábitos de consumo.
    
    REGRAS IMPORTANTES:
    1. A resposta DEVE ser em Português (pode ser PT-BR ou PT-PT).
    2. Foque em áreas de melhoria, tendências de gastos ou sinais positivos de economia.
    3. Seja direto e prático.
    4. Mantenha um tom prestativo, moderno e motivador.
    5. Considere que a moeda é o Euro (€).

    Transações: ${JSON.stringify(summary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao gerar insights de IA. Verifique sua configuração de API ou conexão.";
  }
};
