import { AIMemoryMap, Category, PaymentMethod } from '../../types/finance';

// All AI memory is stored in Neon DB via /api/memory
// No localStorage — shared across all devices

const INITIAL_MEMORY: AIMemoryMap = {
  merchants: {
    'ccd': 'Food & Drinks',
    'starbucks': 'Food & Drinks',
    'swiggy': 'Food & Drinks',
    'zomato': 'Food & Drinks',
    'blinkit': 'Grocery',
    'zepto': 'Grocery',
    'instamart': 'Grocery',
    'uber': 'Travel',
    'ola': 'Travel',
    'amazon': 'Shopping',
    'flipkart': 'Shopping',
    'hpcl': 'Fuel',
    'bpcl': 'Fuel',
    'shell': 'Fuel'
  },
  contacts: {
    'rahul': 'Friend',
    'rohan': 'Friend',
    'priya': 'Sister',
    'mummy': 'Family',
    'papa': 'Family',
    'boss': 'Work'
  },
  paymentPreferences: {
    'petrol': 'UPI',
    'grocery': 'UPI',
    'milk': 'Cash'
  }
};

// In-memory cache so we don't hit the API on every merchant lookup
let memoryCache: AIMemoryMap | null = null;

export async function fetchAIMemory(): Promise<AIMemoryMap> {
  try {
    const res = await fetch('/api/memory');
    if (!res.ok) return memoryCache || INITIAL_MEMORY;
    const data = await res.json();
    const merged: AIMemoryMap = {
      ...INITIAL_MEMORY,
      ...data,
      merchants: { ...INITIAL_MEMORY.merchants, ...(data.merchants || {}) },
      contacts: { ...INITIAL_MEMORY.contacts, ...(data.contacts || {}) },
      paymentPreferences: { ...INITIAL_MEMORY.paymentPreferences, ...(data.paymentPreferences || {}) },
    };
    memoryCache = merged;
    return merged;
  } catch {
    return memoryCache || INITIAL_MEMORY;
  }
}

export async function saveAIMemoryToDb(memory: AIMemoryMap): Promise<void> {
  memoryCache = memory;
  try {
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory)
    });
  } catch (e) {
    console.warn('Failed to save AI memory to Neon:', e);
  }
}

// Synchronous getter — returns cache or INITIAL_MEMORY (used before async load completes)
export function getAIMemory(): AIMemoryMap {
  return memoryCache || INITIAL_MEMORY;
}

export function learnMerchantCategory(merchant: string, category: Category): AIMemoryMap {
  const memory = getAIMemory();
  const key = merchant.toLowerCase().trim();
  if (key && category) {
    memory.merchants[key] = category;
    saveAIMemoryToDb(memory); // fire-and-forget to Neon
  }
  return memory;
}

export function learnPaymentPreference(categoryOrItem: string, method: PaymentMethod): AIMemoryMap {
  const memory = getAIMemory();
  const key = categoryOrItem.toLowerCase().trim();
  if (key && method) {
    memory.paymentPreferences[key] = method;
    saveAIMemoryToDb(memory);
  }
  return memory;
}

export function saveUserFact(key: string, value: string): AIMemoryMap {
  const memory = getAIMemory();
  if (!memory.userFacts) memory.userFacts = {};
  memory.userFacts[key] = value;
  saveAIMemoryToDb(memory);
  return memory;
}

export function saveGoal(key: string, value: string): AIMemoryMap {
  const memory = getAIMemory();
  if (!memory.goals) memory.goals = {};
  memory.goals[key] = value;
  saveAIMemoryToDb(memory);
  return memory;
}

export function saveMonthlyBudget(category: string, amount: number): AIMemoryMap {
  const memory = getAIMemory();
  if (!memory.monthlyBudgets) memory.monthlyBudgets = {};
  memory.monthlyBudgets[category] = amount;
  saveAIMemoryToDb(memory);
  return memory;
}
