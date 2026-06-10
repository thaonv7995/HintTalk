/**
 * Shared parser for model responses that must be a single JSON object.
 * Handles markdown fences, leading/trailing prose, and best-effort repair of
 * JSON that was cut off mid-generation (e.g. the model hit its token limit).
 */

type ScanState = { stack: ('{' | '[')[]; inString: boolean; stringStart: number };

function scanJson(text: string): ScanState {
  const stack: ('{' | '[')[] = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      stringStart = i;
    } else if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    }
  }
  return { stack, inString, stringStart };
}

/** Try to recover truncated JSON by closing open strings/scopes. Returns parsed value or null. */
function parseRepairedTruncatedJson(raw: string): unknown | null {
  const { stack, inString, stringStart } = scanJson(raw);
  if (!stack.length && !inString) return null;

  // Two ways to resolve an unterminated string: close it, or drop the partial string.
  const bases = inString ? [`${raw}"`, raw.slice(0, stringStart)] : [raw];
  for (const base of bases) {
    // Variant 2 additionally drops a dangling `"key":` / trailing separators.
    const variants = [
      base,
      base.replace(/("(?:[^"\\]|\\.)*")?\s*:?\s*$/, '').replace(/[,\s]+$/, ''),
    ];
    for (const variant of variants) {
      const state = scanJson(variant);
      if (state.inString) continue;
      const closers = [...state.stack]
        .reverse()
        .map((c) => (c === '{' ? '}' : ']'))
        .join('');
      try {
        return JSON.parse(variant + closers);
      } catch {
        // try next variant
      }
    }
  }
  return null;
}

export function parseJsonPayload(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?|```$/g, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // fall through to truncation repair
      }
    }
    if (start >= 0) {
      const repaired = parseRepairedTruncatedJson(trimmed.slice(start));
      if (repaired !== null) return repaired;
    }
    throw new Error(`Response is not JSON: ${errMsg}. Output was: "${trimmed.slice(0, 300)}"`, { cause: err });
  }
}
