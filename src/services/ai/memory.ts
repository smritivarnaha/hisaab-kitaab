import { AIMemoryMap, Category, PaymentMethod } from '../../types/finance';

const MEMORY_STORAGE_KEY = 'hisaab_kitab_ai_memory';

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

export function getAIMemory(): AIMemoryMap {
  try {
    const data = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load AI Memory:', e);
  }
  return INITIAL_MEMORY;
}

export function saveAIMemory(memory: AIMemoryMap): void {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch (e) {
    console.error('Failed to save AI Memory:', e);
  }
}

export function learnMerchantCategory(merchant: string, category: Category): AIMemoryMap {
  const memory = getAIMemory();
  const key = merchant.toLowerCase().trim();
  if (key && category) {
    memory.merchants[key] = category;
    saveAIMemory(memory);
  }
  return memory;
}

export function learnPaymentPreference(categoryOrItem: string, method: PaymentMethod): AIMemoryMap {
  const memory = getAIMemory();
  const key = categoryOrItem.toLowerCase().trim();
  if (key && method) {
    memory.paymentPreferences[key] = method;
    saveAIMemory(memory);
  }
  return memory;
}

export function saveUserFact(key: string, value: string): AIMemoryMap {
  const memory = getAIMemory();
  if (!memory.userFacts) memory.userFacts = {};
  memory.userFacts[key] = value;
  saveAIMemory(memory);
  return memory;
}

export function saveGoal(key: string, value: string): AIMemoryMap {
  const memory = getAIMemory();
  if (!memory.goals) memory.goals = {};
  memory.goals[key] = value;
  saveAIMemory(memory);
  return memory;
}

export function saveMonthlyBudget(category: string, amount: number): AIMemoryMap {
  const memory = getAIMemory();
  if (!memory.monthlyBudgets) memory.monthlyBudgets = {};
  memory.monthlyBudgets[category] = amount;
  saveAIMemory(memory);
  return memory;
}
