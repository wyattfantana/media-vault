const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32ToHex = (input: string): string | null => {
  const cleaned = input.toUpperCase().replace(/=+$/g, '');
  let bits = '';

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      return null;
    }
    bits += index.toString(2).padStart(5, '0');
  }

  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16);
  }

  return hex.length === 40 ? hex : null;
};

export const extractMagnetInfoHash = (magnet: string): string | null => {
  if (!magnet) return null;
  const match = magnet.match(/btih:([a-zA-Z0-9]+)/i);
  if (!match) return null;

  const hash = match[1];
  if (/^[a-fA-F0-9]{40}$/.test(hash)) {
    return hash.toLowerCase();
  }

  if (/^[a-zA-Z2-7]{32}$/.test(hash)) {
    return base32ToHex(hash)?.toLowerCase() || null;
  }

  return null;
};
