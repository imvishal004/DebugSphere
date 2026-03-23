/**
 * Basic blocklist of dangerous patterns.
 * Docker already sandboxes execution; this is defence-in-depth.
 */
const BLOCKED_PATTERNS = [
  /Runtime\.getRuntime\(\)\.exec/i,
  /ProcessBuilder/i,
  /os\.system\s*\(/i,
  /subprocess/i,
  /import\s+shutil/i,
  /import\s+socket/i,
  /child_process/i,
  /require\s*\(\s*['"]child_process['"]\s*\)/i,
  /require\s*\(\s*['"]fs['"]\s*\)/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /__import__/i,
  /rm\s+-rf/i,
  /fork\s*\(/i,
  /sys\.exit/i,
];

function sanitizeCode(code) {
  if (!code || typeof code !== "string") {
    throw Object.assign(new Error("Code must be a non-empty string"), { statusCode: 400 });
  }

  if (code.length > 50000) {
    throw Object.assign(new Error("Code exceeds 50 000 character limit"), { statusCode: 400 });
  }

  const warnings = [];
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(`Potentially unsafe pattern detected: ${pattern.source}`);
    }
  }

  return { sanitized: code.trim(), warnings };
}

function sanitizeInput(input) {
  if (input === undefined || input === null) return "";
  if (typeof input !== "string") return String(input);
  if (input.length > 10000) {
    throw Object.assign(new Error("Input exceeds 10 000 character limit"), { statusCode: 400 });
  }
  return input;
}

module.exports = { sanitizeCode, sanitizeInput };