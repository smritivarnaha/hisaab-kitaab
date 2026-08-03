import { Transaction, AIMemoryMap, ChatMessage } from '../../types/finance';

export interface GeminiAgentResponse {
  action: 'CREATE_TRANSACTIONS' | 'DELETE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'SETTLE_DEBT' | 'UPDATE_BUDGET' | 'SAVE_MEMORY' | 'GENERAL_RESPONSE';
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
  transactionToUpdate?: {
    id: string;
    amount?: number;
    title?: string;
    category?: string;
    paymentMethod?: string;
  };
  settleDebtPerson?: string;
  settleDebtAmount?: number;
  memoryToSave?: {
    key: string;
    value: string;
  };
  budgetToUpdate?: {
    category: string;
    amount: number;
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function processWithGeminiAgent(
  userInput: string,
  transactions: Transaction[],
  memory: AIMemoryMap,
  apiKey?: string,
  audioBlob?: Blob,
  chatMessages: ChatMessage[] = [],
  customAIPrompt?: string
): Promise<GeminiAgentResponse | null> {
  const activeKey = apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AQ.Ab8RN6Ie0wYTm7AqZrmWDg0LJfeu3IP-k9IKFAC8PPlgl7Yv5A-';
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

${customAIPrompt ? 'CUSTOM OWNER INSTRUCTIONS (follow these with highest priority):\n' + customAIPrompt + '\n' : ''}
${audioBlob ? 'The user has sent a voice note containing their command. Listen to it and process it directly.' : ''}

USER'S CURRENT LEDGER TRANSACTIONS (${transactions.length} total):
${JSON.stringify(recentTransactionsSummary, null, 2)}

USER'S LEARNED MEMORY & PREFERENCES:
${JSON.stringify(memory, null, 2)}

CONVERSATION HISTORY (recent messages for context):
${chatMessages.slice(-20).map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}

USER MESSAGE TEXT (IF ANY): "${userInput}"

YOUR TASK:
Analyze the user's audio or text message and determine the exact action to perform.
Return ONLY a valid JSON object matching this schema (do NOT include markdown codeblocks or surrounding text):
{
  "action": "CREATE_TRANSACTIONS" | "DELETE_TRANSACTION" | "UPDATE_TRANSACTION" | "SETTLE_DEBT" | "UPDATE_BUDGET" | "SAVE_MEMORY" | "GENERAL_RESPONSE",
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
  "transactionIdToDelete": "${transactions[0]?.id || ''}",
  "transactionToUpdate": {
    "id": "${transactions[0]?.id || ''}",
    "amount": 2500
  },
  "settleDebtPerson": "Rahul",
  "settleDebtAmount": 500,
  "memoryToSave": {
    "key": "Wife Birthday",
    "value": "12th July"
  }
}

CRITICAL RULES:
1. LOGGING vs QUERYING vs ACTIONS:
   - Set action='CREATE_TRANSACTIONS' ONLY when the user is reporting a NEW transaction that just happened (e.g., "Spent 300 on petrol", "Paid 300 to shop", "Lunch 300").
   - Set action='SETTLE_DEBT' when a friend returns money or a loan is paid (e.g., "Rahul returned 500", "Sarthak paid 800"). Specify settleDebtPerson and settleDebtAmount.
   - Set action='UPDATE_TRANSACTION' when the user corrects a previous entry (e.g., "I accidentally entered 250 instead of 2500", "Actually it was 2500"). Look up the matching transaction ID in USER'S CURRENT LEDGER TRANSACTIONS.
   - Set action='SAVE_MEMORY' when the user shares a personal fact, habit, date, or target (e.g., "My wife's birthday is on 12th July", "I want to save 3 lakh this year"). Specify memoryToSave.key and memoryToSave.value.
   - If the user asks a question about past spending, requests to find/locate transactions, requests summaries, or asks about balances/history (e.g., "where did I spend 300 rupees?", "show transactions of 300", "did I pay Rohan?", "how much is spent?"), this is a QUERY. Set action='GENERAL_RESPONSE' and search through the provided USER'S CURRENT LEDGER TRANSACTIONS list to give a helpful answer. NEVER create a new transaction for a question, inquiry, search, or query!
2. TITLE AUTOCORRECTION: Autocorrect the spellings and names of transaction titles/merchants (in Hindi, Hinglish, or English) to a clean, professional, capitalized representation. Only correct the spelling and format it (e.g. "chooran" -> "Churan", "doodh" -> "Milk", "toothbrush softbrush" -> "Toothbrush"). Never append extra descriptive words like "Candy", "Item", or "Shop" to corrected titles.
3. CATEGORIZATION RULES:
   - Map traditional Indian snacks, street food, digestives, candy, and Hinglish food terms (e.g., chooran, churan, hajmola, namkeen, samosa, mithai, biscuit, chips, cold drink, soda, lassi) to **"Food & Drinks"** or **"Grocery"** (e.g. for bulk supplies), NEVER to "Others". They are eating/drinking items!
   - Map toiletries, personal care, household hygiene, and cleaning products (e.g., toothbrush, brush, toothpaste, paste, soap, shampoo, conditioner, detergent, surf excel, cleaner, Harpic, tissue, wiper) to **"Grocery"** or **"Shopping"** (prefer **"Grocery"** for daily consumable essentials), NEVER to "Others".
   - Default to "Others" only if a category is completely unrecognizable or miscellaneous.
4. ASK USER FOR CONFIRMATION: The transactions are NOT saved directly to the final passbook; they are queued in a pending list first. Phrase your responseText as a question asking if you understood correctly. Do NOT include "via UPI", "via Cash", or "via [method]" or category tags like "(Grocery)" in the confirmation message.
   - Example responseText: "I recorded an expense of **Rs. 144** for **Toothbrush**. Is this correct?"
5. If the user asks to delete, undo, or cancel (e.g. "delete last transaction", "can yo delete last trasction"), set action="DELETE_TRANSACTION" and set transactionIdToDelete="${transactions[0]?.id || ''}".
6. If the user asks a financial question, requests a summary, or asks for advice, set action="GENERAL_RESPONSE" and answer with clean, organized markdown tables or bullet points.
7. If the user sends random gibberish or invalid text (e.g. "adshfadjf"), set action="GENERAL_RESPONSE" and respond: "I couldn't detect a valid amount or financial entry in your message. Try saying e.g. 'Petrol 2200' or 'Spent 23 for Nandini'!"
  `;

  try {
    const parts: any[] = [];
    if (audioBlob) {
      const base64Audio = await blobToBase64(audioBlob);
      parts.push({
        inlineData: {
          mimeType: audioBlob.type || 'audio/webm',
          data: base64Audio
        }
      });
    }
    parts.push({ text: systemPrompt });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
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
