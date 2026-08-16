/**
 * Standard global date formatter for Hisaab Kitab.
 * Formats any date string, timestamp, or Date object as "DD MMM YY" (e.g., "03 Aug 26").
 */
export function formatGlobalDate(dateInput?: string | number | Date): string {
  if (!dateInput) {
    return formatDateToCustom(new Date());
  }

  try {
    let d: Date;
    if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      // If ISO format like '2026-08-03', split manually to prevent UTC shift
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        d = new Date(year, month, day);
      } else {
        d = new Date(dateInput);
      }
    } else {
      d = dateInput;
    }

    if (isNaN(d.getTime())) {
      return String(dateInput);
    }

    return formatDateToCustom(d);
  } catch {
    return String(dateInput);
  }
}

function formatDateToCustom(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()] || 'Aug';
  const year = String(d.getFullYear()).slice(-2); // "26"
  return `${day} ${month} ${year}`;
}

export function sortTransactionsLatestFirst<T extends { date?: string; timestamp?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const getTime = (item: T) => {
      if (item.date) {
        const parts = item.date.split('T')[0].split('-');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
        }
      }
      return item.timestamp || 0;
    };
    const timeA = getTime(a);
    const timeB = getTime(b);
    if (timeA !== timeB) return timeB - timeA;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

export function getStartOfTodayTimestamp(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
