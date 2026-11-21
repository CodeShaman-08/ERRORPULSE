import crypto from 'crypto';

/**
 * Generates an MD5 fingerprint from an error message and stack trace.
 * @param {string} message - The error message
 * @param {string} stack - The error stack trace string
 * @returns {string} 32-character hexadecimal string
 */
export const generateFingerprint = (message = '', stack = '') => {
  // Clean and normalize the error message
  const cleanMessage = message.trim().toLowerCase();

  // Extract the top frame from the stack trace
  const stackLines = stack ? stack.split('\n') : [];
  let primaryFrame = '';

  if (stackLines.length > 1) {
    // Get line 1 of the stack trace and remove specific line/column numbers
    // so minor line shifts don't break the grouping hash
    primaryFrame = stackLines[1]
      .trim()
      .replace(/:\d+:\d+/g, '')
      .toLowerCase();
  }

  // Combine error message and primary stack frame
  const rawString = `${cleanMessage}::${primaryFrame}`;

  // Generate MD5 hash
  return crypto.createHash('md5').update(rawString).digest('hex');
};