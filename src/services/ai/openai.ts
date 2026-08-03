import { Transaction, AIMemoryMap, ChatMessage } from '../../types/finance';
import { GeminiAgentResponse } from './gemini';

function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || 'audio/wav' });
}

export async function transcribeWithWhisper(audioBlob: Blob, apiKey: string): Promise<string | null> {
  try {
    // Derive file extension from actual MIME type
    const mimeType = audioBlob.type || 'audio/webm';
    const ext = mimeType.includes('mp4') ? 'mp4'
              : mimeType.includes('ogg') ? 'ogg'
              : mimeType.includes('wav') ? 'wav'
              : 'webm';

    const formData = new FormData();
    const file = new File([audioBlob], `recording.${ext}`, { type: mimeType });
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    // No 'language' param — Whisper auto-detects Hindi/Hinglish/English
    // Prompt guides Whisper toward Indian financial vocabulary
    formData.append('prompt', 'Indian finance: rupees, UPI, petrol, grocery, salary, Hinglish.');
    formData.append('response_format', 'text');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.warn('Whisper API error:', res.status, errText);
      return null;
    }
    const text = await res.text();
    return text?.trim() || null;
  } catch (err) {
    console.warn('Whisper transcription error:', err);
    return null;
  }
}



export async function processWithOpenAIAgent(
  userInput: string,
  transactions: Transaction[],
  memory: AIMemoryMap,
  apiKey?: string,
  audioBlob?: Blob,
  chatMessages: ChatMessage[] = []
): Promise<GeminiAgentResponse | null> {
  const activeKey = apiKey || (import.meta as any).env?.VITE_OPENAI_API_KEY;
  if (!activeKey || !activeKey.trim()) return null;

  let promptInput = userInput;
  if (audioBlob) {
    const whisperText = await transcribeWithWhisper(audioBlob, activeKey);
    if (whisperText) {
      promptInput = whisperText;
    }
  }

  const recentTransactionsSummary = transactions.slice(0, 25).map(t => ({
    id: t.id,
    amount: t.amount,
    title: t.title,
    category: t.category,
    type: t.type,
    paymentMethod: t.paymentMethod,
    person: t.person,
    merchant: t.merchant,
    date: t.date
  }));

  const systemPrompt = `
You are Hisaab Kitab AI - an autonomous, highly intelligent voice finance agent & accountant for India.
You manage money ledgers, parse user inputs in English, Hindi, and Hinglish, execute ledger operations, and answer complex accounting queries.

USER'S CURRENT LEDGER TRANSACTIONS (${transactions.length} total):
${JSON.stringify(recentTransactionsSummary, null, 2)}

USER'S LEARNED MEMORY & PREFERENCES:
${JSON.stringify(memory, null, 2)}

CONVERSATION HISTORY (recent messages for context):
${chatMessages.slice(-20).map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}

USER MESSAGE TEXT: "${promptInput}"

YOUR TASK:
Analyze the user's message and determine the exact tool/action to perform.
Return ONLY a valid JSON object matching this schema:
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
0. MULTI-ITEM EXTRACTION RULE:
   - When the user lists multiple items or expenses in a single message or voice note (for example: 30 banana, 50 aloo, 30 kismis, 50 for adrak, 80 apple or 200 petrol, 150 swiggy, 50 milk), you MUST extract EVERY SINGLE ITEM as a DISTINCT, SEPARATE object inside the transactionsToCreate array!
   - Do NOT merge them into one single item or calculate a single sum!
   - Create item 1: title Banana, amount 30, category Grocery
   - Create item 2: title Aloo, amount 50, category Grocery
   - Create item 3: title Kismis, amount 30, category Grocery
   - Create item 4: title Adrak, amount 50, category Grocery
   - Create item 5: title Apple, amount 80, category Grocery
1. LOGGING vs QUERYING:
   - Set action='CREATE_TRANSACTIONS' ONLY when the user is reporting a NEW transaction that just happened.
   - If the user asks a question, requests summaries, or asks about balances/history, set action='GENERAL_RESPONSE' and answer from the transactions list. NEVER create a new transaction for a question!
2. TITLE & NUMBER PARSING:
   - Convert spoken numbers naturally (e.g. "fifty thousand" -> 50000, "two thousand two hundred" -> 2200).
   - Format merchant and title names cleanly.
3. ASK USER FOR CONFIRMATION:
   - The transactions are NOT saved directly to the final passbook; they are queued in a pending list first. Phrase your responseText as a question asking if you understood correctly (e.g. "I recorded an expense of **Rs. 144** for **Toothbrush**. Is this correct?").
   - Do NOT include payment methods or category tags (e.g. "(Grocery)") in the final responseText or speechText.
`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeKey.trim()}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptInput }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return parsed as GeminiAgentResponse;
  } catch (err) {
    console.error('OpenAI Agent processing exception:', err);
    return null;
  }
}
