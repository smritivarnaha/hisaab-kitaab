import { ReceiptData } from '../../types/finance';

export async function processReceiptImage(file: File): Promise<ReceiptData> {
  // Simulate OCR extraction from receipt image
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        merchant: file.name.includes('bill') ? 'Blinkit Retail' : 'HP Petrol Pump',
        date: new Date().toISOString().split('T')[0],
        totalAmount: 1450,
        confidence: 95,
        items: [
          { name: 'Receipt Item 1', price: 1450, category: 'Grocery' }
        ]
      });
    }, 1200);
  });
}
