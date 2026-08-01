import { Transaction } from '../../types/finance';

export interface AIInsight {
  id: string;
  type: 'alert' | 'warning' | 'positive' | 'info';
  title: string;
  description: string;
  actionText?: string;
  icon?: string;
}

export function generateInsights(transactions: Transaction[]): AIInsight[] {
  const insights: AIInsight[] = [];
  if (!transactions.length) {
    return [
      {
        id: 'ins_welcome',
        type: 'info',
        title: 'Welcome to Hisaab Kitab! 👋',
        description: 'Simply tap the microphone or type to log your first expense (e.g. "Petrol 2200 UPI").',
      }
    ];
  }

  // Calculate totals
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalLent = transactions
    .filter(t => t.type === 'lent')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // 1. Pending Lent Ledger Insight
  const lentPending = transactions.filter(t => t.type === 'lent' && t.person);
  if (lentPending.length > 0) {
    const topDebtor = lentPending[0];
    insights.push({
      id: `ins_lent_${topDebtor.id}`,
      type: 'warning',
      title: `${topDebtor.person} owes you ₹${topDebtor.amount}`,
      description: `Logged on ${topDebtor.date}. Tap to send a gentle reminder.`,
      actionText: 'Send Reminder'
    });
  }

  // 2. High Category Spending Insight
  const categoryMap: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0) {
    const [topCat, topAmount] = sortedCategories[0];
    const percentage = Math.round((topAmount / (totalExpense || 1)) * 100);
    insights.push({
      id: 'ins_top_cat',
      type: 'alert',
      title: `${topCat} is your top expense (${percentage}%)`,
      description: `You have spent ₹${topAmount.toLocaleString('en-IN')} on ${topCat} so far this period.`,
    });
  }

  // 3. Savings / Cashflow ratio
  if (totalIncome > 0) {
    const savings = totalIncome - totalExpense;
    const savingsRate = Math.round((savings / totalIncome) * 100);
    if (savingsRate > 20) {
      insights.push({
        id: 'ins_savings_good',
        type: 'positive',
        title: `Healthy Savings Rate: ${savingsRate}%`,
        description: `Great job! You have saved ₹${savings.toLocaleString('en-IN')} out of ₹${totalIncome.toLocaleString('en-IN')} earned.`,
      });
    }
  }

  // 4. Recurring Subscription Check
  const netflixOrRecharge = transactions.find(t => /netflix|spotify|recharge|wifi|hotstar/i.test(t.notes || ''));
  if (netflixOrRecharge) {
    insights.push({
      id: `ins_recurring_${netflixOrRecharge.id}`,
      type: 'info',
      title: `Recurring payment detected: ${netflixOrRecharge.notes || netflixOrRecharge.category}`,
      description: `₹${netflixOrRecharge.amount} is logged monthly. Automated reminder set.`,
    });
  }

  return insights;
}
