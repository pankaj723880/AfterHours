import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from backend/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function sanitize(msg = '') {
  if (!msg) return '';
  const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
  return str.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
}

async function testSingleKey(keyName, keyValue, modelName) {
  const result = {
    keyName,
    configured: Boolean(keyValue && keyValue.trim()),
    length: keyValue ? keyValue.trim().length : 0,
    status: 'NOT_CONFIGURED',
    httpStatus: null,
    modelTested: modelName,
    responseGenerated: false,
    projectNumber: null,
    errorMessage: null
  };

  if (!result.configured) {
    result.status = 'NOT_CONFIGURED';
    result.errorMessage = `${keyName} is empty or not set in environment`;
    return result;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: keyValue.trim() });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Respond with the word "pong" only.'
    });

    const text = response.text ? response.text.trim() : '';
    if (text) {
      result.status = 'WORKING';
      result.httpStatus = 200;
      result.responseGenerated = true;
    } else {
      result.status = 'EMPTY_RESPONSE';
      result.httpStatus = 200;
      result.errorMessage = 'API call succeeded but returned no text candidate.';
    }
  } catch (err) {
    const status = err.status || err.statusCode || err.code || null;
    result.httpStatus = status;

    const rawMsg = err.message || '';
    const safeMsg = sanitize(rawMsg);
    result.errorMessage = safeMsg;

    // Extract project ID / number from Google Cloud Error details if available
    const projMatch = rawMsg.match(/projects\/([0-9]+)/) || rawMsg.match(/project[ =]+([0-9]+)/);
    if (projMatch) {
      result.projectNumber = projMatch[1];
    }

    const lower = rawMsg.toLowerCase();
    if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit')) {
      result.status = 'QUOTA_EXHAUSTED';
    } else if (status === 401 || lower.includes('unauthenticated') || lower.includes('api key not valid') || lower.includes('api_key_invalid')) {
      result.status = 'INVALID';
    } else if (status === 403 || lower.includes('permission_denied') || lower.includes('service_disabled') || lower.includes('blocked')) {
      result.status = 'PERMISSION_DENIED';
    } else {
      result.status = 'OTHER_ERROR';
    }
  }

  return result;
}

export async function runDiagnostics() {
  const primaryKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const secondaryKey = (process.env.GEMINI_API_KEY_2 || '').trim();
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const primaryReport = await testSingleKey('GEMINI_API_KEY', primaryKey, configuredModel);
  const secondaryReport = await testSingleKey('GEMINI_API_KEY_2', secondaryKey, configuredModel);

  let sameProject = false;
  let sharedProjectNumber = null;
  if (primaryReport.projectNumber && secondaryReport.projectNumber) {
    sameProject = primaryReport.projectNumber === secondaryReport.projectNumber;
    sharedProjectNumber = sameProject ? primaryReport.projectNumber : null;
  }

  return {
    timestamp: new Date().toISOString(),
    modelConfigured: configuredModel,
    primary: primaryReport,
    secondary: secondaryReport,
    projectAnalysis: {
      sameProject,
      sharedProjectNumber,
      note: sameProject
        ? 'Both keys belong to the exact same Google Cloud project. Quotas are shared at the project level, so a secondary key in the same project CANNOT provide independent quota fallback on 429.'
        : 'Keys have distinct or undetectable projects.'
    }
  };
}

if (process.argv[1] && process.argv[1].endsWith('diagnose_gemini_keys.js')) {
  runDiagnostics().then(report => {
    console.log(JSON.stringify(report, null, 2));
  }).catch(e => {
    console.error('Diagnostic error:', sanitize(e.message));
  });
}

