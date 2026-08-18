/**
 * Smart Local & Push Notification Service
 * Handles:
 * 1. Evening 9:00 PM Daily Expense Reconciliation Recap
 * 2. Instant Business Partner Activity Alerts (e.g., Sarthak logs a business expense)
 * 3. Haptic vibration feedback
 */

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: {
    url?: string;
    type?: 'reconciliation' | 'partner_alert' | 'update';
    transactionId?: string;
  };
}

// Request Notification Permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  return false;
}

// Trigger a native/local notification
export function sendNotification(payload: NotificationPayload): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const options: any = {
        body: payload.body,
        icon: payload.icon || '/logo.png',
        badge: '/favicon.png',
        data: payload.data,
        tag: payload.data?.type || 'funds_logger_general',
        vibrate: [200, 100, 200]
      };

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(payload.title, options);
        });
      } else {
        const notif = new Notification(payload.title, options);
        notif.onclick = () => {
          window.focus();
          if (payload.data?.url) {
            window.location.href = payload.data.url;
          }
          notif.close();
        };
      }
    } catch (err) {
      console.warn('Could not display notification:', err);
    }
  }

  // Trigger physical haptic vibration if supported
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch {}
  }
}

// Send Business Partner Activity Alert
export function sendPartnerBusinessAlert(
  partnerName: string,
  txType: 'income' | 'expense' | 'lent' | 'borrowed' | 'transfer',
  amount: number,
  title: string
): void {
  const typeLabel = 
    txType === 'income' ? 'Business Income' : 
    txType === 'expense' ? 'Business Expense' : 
    txType === 'lent' ? 'Direct Transfer Given' : 'Business Entry';

  sendNotification({
    title: `🏢 ${partnerName} logged ${typeLabel}`,
    body: `₹${amount.toLocaleString('en-IN')} for "${title}". Tap to view in Business Passbook.`,
    icon: '/logo.png',
    data: {
      type: 'partner_alert',
      url: '/?tab=business'
    }
  });
}

// Check and schedule Daily 9:00 PM Reconciliation Recap
export function checkAndTriggerDailyRecap(todayExpenseCount: number, todayExpenseTotal: number): void {
  if (typeof window === 'undefined') return;

  const now = new Date();
  const todayKey = `recap_sent_${now.toISOString().split('T')[0]}`;
  
  // Send once per day between 9:00 PM and 11:59 PM (or if requested)
  if (now.getHours() >= 21 && !localStorage.getItem(todayKey)) {
    localStorage.setItem(todayKey, 'true');

    if (todayExpenseCount > 0) {
      sendNotification({
        title: '🌙 Daily Funds Log Recap',
        body: `You logged ${todayExpenseCount} expense${todayExpenseCount > 1 ? 's' : ''} today totaling ₹${todayExpenseTotal.toLocaleString('en-IN')}. Tap to review passbook.`,
        icon: '/logo.png',
        data: {
          type: 'reconciliation',
          url: '/?tab=passbook'
        }
      });
    } else {
      sendNotification({
        title: '🌙 Daily Funds Log Reminder',
        body: 'Did you spend anything today? Tap to record your daily expenses in 2 seconds.',
        icon: '/logo.png',
        data: {
          type: 'reconciliation',
          url: '/?tab=chat'
        }
      });
    }
  }
}
