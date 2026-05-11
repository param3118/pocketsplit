/**
 * Validation utilities.
 * All monetary amounts are in integer paise/cents.
 */

function validateAmount(amount) {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return 'Amount must be a positive integer (in paise/cents)';
  }
  return null;
}

function validateSplitType(splitType) {
  if (!['equal', 'unequal'].includes(splitType)) {
    return 'split_type must be "equal" or "unequal"';
  }
  return null;
}

function validateShares(totalAmount, shares) {
  if (!shares || !Array.isArray(shares) || shares.length === 0) {
    return 'shares must be a non-empty array';
  }
  const sum = shares.reduce((acc, s) => acc + (s.share_amount || 0), 0);
  if (sum !== totalAmount) {
    return `Sum of shares (${sum}) must equal total_amount (${totalAmount})`;
  }
  return null;
}

function validateNonEmpty(value, fieldName) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required and cannot be empty`;
  }
  return null;
}

module.exports = {
  validateAmount,
  validateSplitType,
  validateShares,
  validateNonEmpty
};