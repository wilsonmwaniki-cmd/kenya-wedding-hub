const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';

const ALL_PASSWORD_CHARS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;

function getRandomChar(source: string) {
  const randomValue = new Uint32Array(1);
  window.crypto.getRandomValues(randomValue);
  return source[randomValue[0] % source.length];
}

function shuffle(chars: string[]) {
  const values = new Uint32Array(chars.length);
  window.crypto.getRandomValues(values);

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = values[index] % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars;
}

export function createSecurePassword(length = 16) {
  const safeLength = Math.max(length, 8);
  const chars = [
    getRandomChar(UPPERCASE),
    getRandomChar(LOWERCASE),
    getRandomChar(DIGITS),
    getRandomChar(SYMBOLS),
  ];

  while (chars.length < safeLength) {
    chars.push(getRandomChar(ALL_PASSWORD_CHARS));
  }

  return shuffle(chars).join('');
}

export function validatePasswordRequirements(password: string) {
  if (password.length < 6) {
    return 'Use at least 6 characters.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Include at least one lowercase letter.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Include at least one uppercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Include at least one number.';
  }

  return null;
}

export async function copyTextWithFallback(value: string) {
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy copy path below.
  }

  const fallbackInput = document.createElement('textarea');
  fallbackInput.value = value;
  fallbackInput.setAttribute('readonly', '');
  fallbackInput.style.position = 'fixed';
  fallbackInput.style.opacity = '0';
  fallbackInput.style.pointerEvents = 'none';
  document.body.appendChild(fallbackInput);
  fallbackInput.focus();
  fallbackInput.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(fallbackInput);
  }
}
