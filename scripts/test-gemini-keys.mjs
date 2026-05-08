import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local');
  process.exit(1);
}

dotenv.config({ path: envPath });

const keyEntries = [1, 2, 3, 4, 5].map((index) => ({
  label: `VITE_GEMINI_API_KEY_${index}`,
  value: process.env[`VITE_GEMINI_API_KEY_${index}`],
}));

const maskKey = (value) => {
  if (!value) {
    return 'missing';
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const isQuotaError = (message) => {
  const normalized = String(message || '').toUpperCase();
  return (
    normalized.includes('RESOURCE_EXHAUSTED') ||
    normalized.includes('QUOTA EXCEEDED') ||
    normalized.includes('RATE LIMIT') ||
    normalized.includes('TOO MANY REQUESTS') ||
    normalized.includes('429')
  );
};

const extractResponseText = (response) => {
  const directText = String(response?.text || '').trim();
  if (directText) {
    return directText;
  }

  const candidateTexts = (response?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
    .filter(Boolean);

  return candidateTexts.join(' ').trim();
};

const validateKey = async ({ label, value }) => {
  if (!value || value === 'AI Studio Free Tier') {
    return {
      label,
      ok: false,
      level: 'fail',
      reason: 'Missing key',
      maskedKey: maskKey(value),
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: value });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Reply with exactly OK',
      config: {
        maxOutputTokens: 64,
        temperature: 0,
      },
    });

    const text = extractResponseText(response).toUpperCase();
    if (!text.includes('OK')) {
      return {
        label,
        ok: false,
        level: 'fail',
        reason: `Unexpected response: ${text || 'empty response'}${response?.candidates?.[0]?.finishReason ? ` (finishReason: ${response.candidates[0].finishReason})` : ''}`,
        maskedKey: maskKey(value),
      };
    }

    return {
      label,
      ok: true,
      level: 'ok',
      reason: 'Valid and working',
      maskedKey: maskKey(value),
    };
  } catch (error) {
    const reason = String(error?.message || error);
    return {
      label,
      ok: false,
      level: isQuotaError(reason) ? 'warn' : 'fail',
      reason: isQuotaError(reason) ? `Valid but quota-exhausted: ${reason}` : reason,
      maskedKey: maskKey(value),
    };
  }
};

const results = [];
for (const keyEntry of keyEntries) {
  results.push(await validateKey(keyEntry));
}

for (const result of results) {
  const status = result.level === 'ok' ? 'OK' : result.level === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${status} ${result.label} (${result.maskedKey}) - ${result.reason}`);
}

const failures = results.filter((result) => result.level === 'fail');
const warnings = results.filter((result) => result.level === 'warn');
if (failures.length > 0) {
  console.error(`\n${failures.length} Gemini key validation failure(s).`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} Gemini key(s) are valid but currently quota-exhausted.`);
  process.exit(0);
}

console.log('\nAll five Gemini keys are valid and working.');