import { Transaction, AIMemoryMap } from '../../types/finance';

export interface GeminiAgentResponse {
  action: 'CREATE_TRANSACTIONS' | 'DELETE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'GENERAL_RESPONSE';
  responseText: string;
  speechText?: string;
  transactionsToCreate?: Array<{
    amount: number;
    title: string;
    category: string;
    paymentMethod: string;
    type: 'expense' | 'income' | 'lent' | 'borrowed';
    person?: string;
    merchant?: string;
    date?: string;
  }>;
  transactionIdToDelete?: string;
}

export async function processWithGeminiAgent(
  userInput: string,
  transactions: Transaction[],
  memory: AIMemoryMap,
  apiKey?: string
): Promise<GeminiAgentResponse | null> {
  const activeKey = apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!activeKey || !activeKey.trim()) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey.trim()}`;

  const recentTransactionsSummary = transactions.slice(0, 20).map(t => ({
    id: t.id,
    amount: t.amount,
    title: t.title,
    category: t.category,
    type: t.type,
    paymentMethod: t.paymentMethod,
    person: t.person,
    date: t.date
  }));

  const systemPrompt = `
You are Hisaab Kitab AI - an autonomous, highly intelligent voice finance agent & accountant for India.
You manage money ledgers, parse user inputs in English, Hindi, and Hinglish, execute ledger operations (create, delete, edit), and answer complex accounting queries.

USER'S CURRENT LEDGER TRANSACTIONS (${transactions.length} total):
${JSON.stringify(recentTransactionsSummary, null, 2)}

USER'S LEARNED MEMORY & PREFERENCES:
${JSON.stringify(memory, null, 2)}

USER MESSAGE: "${userInput}"

YOUR TASK:
Analyze the user's message and determine the exact action to perform.
Return ONLY a valid JSON object matching this schema (do NOT include markdown codeblocks or surrounding text):
{
  "action": "CREATE_TRANSACTIONS" | "DELETE_TRANSACTION" | "UPDATE_TRANSACTION" | "GENERAL_RESPONSE",
  "responseText": "Markdown formatted AI answer for the user interface",
  "speechText": "Concise natural text to speak aloud via text-to-speech",
  "transactionsToCreate": [
    {
      "amount": 23,
      "title": "Nandini",
      "category": "Others",
      "paymentMethod": "UPI",
      "type": "expense",
      "person": "Nandini"
    }
  ],
  "transactionIdToDelete": "${transactions[0]?.id || ''}"
}

CRITICAL RULES:
1. If the user describes spending, income, or lending (e.g., "hi how are you so I spend 23 rupees in the name of Nandini"), set action="CREATE_TRANSACTIONS", extract amount=23, title="Nandini", person="Nandini". NEVER create 0 amount transactions.
2. TITLE AUTOCORRECTION: Autocorrect the spellings and names of transaction titles/merchants (in Hindi, Hinglish, or English) to a clean, professional, capitalized representation.
   - Example: "toothbrush softbrush" or "softbrush" -> "Toothbrush", "doodh" -> "Milk", "sabji" -> "Vegetables", "dawa" -> "Medicine", "kirana" -> "Grocery".
3. CATEGORIZATION RULES:
   - Map traditional Indian snacks, street food, digestives, candy, and Hinglish food terms (e.g., chooran, churan, hajmola, namkeen, samosa, mithai, biscuit, chips, cold drink, soda, lassi) to **"Food & Drinks"** or **"Grocery"** (e.g. for bulk supplies), NEVER to "Others". They are eating/drinking items!
   - Map toiletries, personal care, household hygiene, and cleaning products (e.g., toothbrush, brush, toothpaste, paste, soap, shampoo, conditioner, detergent, surf excel, cleaner, Harpic, tissue, wiper) to **"Grocery"** or **"Shopping"** (prefer **"Grocery"** for daily consumable essentials), NEVER to "Others".
   - Default to "Others" only if a category is completely unrecognizable or miscellaneous.
4. REMOVE PAYMENT METHOD IN CONFIRMATIONS: Do NOT include "via UPI", "via Cash", or "via [method]" in the responseText or speechText. Keep the response text and speech text clean and elegant.
   - Example responseText: "Saved **Rs. 144** for **Toothbrush** (Grocery) as Expense. Added to Passbook!"
5. If the user asks to delete, undo, or cancel (e.g. "delete last transaction", "can yo delete last trasction"), set action="DELETE_TRANSACTION" and set transactionIdToDelete="${transactions[0]?.id || ''}".
6. If the user asks a financial question, requests a summary, or asks for advice, set action="GENERAL_RESPONSE" and answer with clean, organized markdown tables or bullet points.
7. If the user sends random gibberish or invalid text (e.g. "adshfadjf"), set action="GENERAL_RESPONSE" and respond: "I couldn't detect a valid amount or financial entry in your message. Try saying e.g. 'Petrol 2200' or 'Spent 23 for Nandini'!"
  `;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!res.ok) {
      console.warn('Gemini API request status error:', res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const cleanedText = candidateText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanedText);
    return parsed as GeminiAgentResponse;
  } catch (err) {
    console.error('Gemini Agent processing exception:', err);
    return null;
  }
}
