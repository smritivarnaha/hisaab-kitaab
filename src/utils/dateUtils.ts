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
