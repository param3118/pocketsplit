// Format paise to ₹ string
export function formatAmount(paise) {
  if (paise === null || paise === undefined) return '₹0';
  const rupees = Math.abs(paise) / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatAmountSigned(paise) {
  if (!paise) return '₹0';
  const sign = paise >= 0 ? '+' : '-';
  return `${sign}${formatAmount(Math.abs(paise))}`;
}

// Parse ₹ input to paise
export function toPaise(rupeesStr) {
  const val = parseFloat(rupeesStr);
  if (isNaN(val) || val <= 0) return null;
  return Math.round(val * 100);
}

// Format date
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateKey(dateStr) {
  if (!dateStr) return '';
  
  let str = dateStr;
  if (dateStr instanceof Date) {
    str = dateStr.toISOString();
  }
  
  if (typeof str !== 'string') return '';

  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // If it's YYYY-MM-DD HH:MM:SS or ISO
  return str.substring(0, 10);
}

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const key = formatDateKey(dateStr);
  const [y, m, d] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

export function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Group expenses by date
export function groupByDate(expenses) {
  const grouped = {};
  for (const exp of expenses) {
    const key = formatDateKey(exp.created_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(exp);
  }
  return grouped;
}