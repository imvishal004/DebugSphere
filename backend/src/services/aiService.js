// ─────────────────────────────────────────────────────────────
// aiService.js
//
// AI provider : NVIDIA NIM
// Model       : openai/gpt-oss-120b
// base_url    : https://integrate.api.nvidia.com/v1
//
// Mirrors your Python snippet exactly:
//   model       = "openai/gpt-oss-120b"
//   temperature = 1
//   top_p       = 1
//   max_tokens  = 4096
//   stream      = True
//   reasoning_content parsed from delta (same as before)
// ─────────────────────────────────────────────────────────────

const https = require("https");

// ── Configuration ─────────────────────────────────────────────
const CONFIG = {
  apiKey:   process.env.NVIDIA_API_KEY || "",
  model:    process.env.AI_MODEL       || "openai/gpt-oss-120b",

  // NVIDIA NIM endpoint
  baseHost: "integrate.api.nvidia.com",
  basePath: "/v1/chat/completions",

  // Exact values from your Python snippet
  temperature: parseFloat(process.env.AI_TEMPERATURE) || 1,
  topP:        parseFloat(process.env.AI_TOP_P)       || 1,
  maxTokens:   parseInt(process.env.AI_MAX_TOKENS, 10) || 4096,

  // Streaming timeouts
  firstChunkTimeoutMs: parseInt(process.env.AI_FIRST_CHUNK_TIMEOUT, 10) || 60000,  // 60s
  idleTimeoutMs:       parseInt(process.env.AI_IDLE_TIMEOUT, 10)        || 30000,  // 30s

  // Kill switch
  enabled: process.env.AI_ENABLED !== "false",
};

// ── Prompt builder ─────────────────────────────────────────────
function buildMessages(language, code, errorText, exitCode) {
  const systemPrompt =
    `You are an expert ${language} debugging assistant integrated into ` +
    `a cloud code execution platform.\n\n` +
    `Your job is to analyze code that failed to execute and provide:\n` +
    `1. A clear explanation of what went wrong (2-4 sentences).\n` +
    `2. A concrete fix suggestion with corrected code if applicable.\n\n` +
    `Rules:\n` +
    `- Be direct and specific. No generic advice.\n` +
    `- Reference exact line numbers or symbols when possible.\n` +
    `- Keep explanation under 200 words.\n` +
    `- Keep suggestion under 300 words.\n` +
    `- Respond with ONLY a raw JSON object, no markdown, no extra text:\n` +
    `  {"explanation":"...","suggestion":"..."}`;

  const userPrompt =
    `Language: ${language}\n` +
    `Exit Code: ${exitCode}\n\n` +
    `--- CODE ---\n${code}\n\n` +
    `--- ERROR OUTPUT ---\n` +
    `${errorText || "(no error output — check logic or runtime crash)"}\n\n` +
    `Respond with the JSON object only.`;

  return { systemPrompt, userPrompt };
}

// ── SSE line processor ─────────────────────────────────────────
// Mirrors your Python for-loop:
//
//   for chunk in completion:
//     if not getattr(chunk, "choices", None): continue
//     reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
//     if reasoning: print(reasoning)
//     if chunk.choices[0].delta.content is not None: print(content)
//
function processSSELine(line, state) {
  const trimmed = line.trim();

  if (!trimmed)                      return;
  if (trimmed === "data: [DONE]")    return;
  if (!trimmed.startsWith("data: ")) return;

  const jsonStr = trimmed.slice(6);

  let chunk;
  try { chunk = JSON.parse(jsonStr); }
  catch { return; }

  // Mirror: if not getattr(chunk, "choices", None): continue
  const choices = chunk.choices;
  if (!choices || choices.length === 0) {
    // Still capture token usage from usage-only chunks
    if (chunk.usage?.total_tokens) {
      state.tokensUsed = chunk.usage.total_tokens;
    }
    return;
  }

  const delta = choices[0]?.delta;
  if (!delta) return;

  // Mirror: reasoning_content
  const reasoning = delta.reasoning_content;
  if (reasoning) {
    state.reasoningContent += reasoning;
  }

  // Mirror: chunk.choices[0].delta.content
  if (delta.content !== null && delta.content !== undefined) {
    state.content += delta.content;
  }
}

// ── True streaming HTTPS caller ────────────────────────────────
// Processes each SSE chunk as it arrives.
// Two independent timers:
//   firstChunkTimer — fires if model never starts responding
//   idleTimer       — fires if stream stalls mid-response
function callNvidiaAI(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    if (!CONFIG.apiKey) {
      return reject(
        new Error(
          "NVIDIA_API_KEY is not set. " +
          "Add NVIDIA_API_KEY=nvapi-... to backend/.env"
        )
      );
    }

    // ── Request body — exact mirror of Python snippet ──────────
    const body = JSON.stringify({
      model:       CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      temperature: CONFIG.temperature,   // 1
      top_p:       CONFIG.topP,          // 1
      max_tokens:  CONFIG.maxTokens,     // 4096
      stream:      true,
      // No chat_template_kwargs — gpt-oss-120b does not need it
    });

    const options = {
      hostname: CONFIG.baseHost,
      path:     CONFIG.basePath,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization":  `Bearer ${CONFIG.apiKey}`,
        "Accept":         "text/event-stream",
        "Connection":     "keep-alive",
      },
    };

    console.log(`📡  → POST https://${CONFIG.baseHost}${CONFIG.basePath}`);
    console.log(`📡  → Model: ${CONFIG.model}`);
    console.log(
      `📡  → First-chunk timeout: ${CONFIG.firstChunkTimeoutMs / 1000}s | ` +
      `Idle timeout: ${CONFIG.idleTimeoutMs / 1000}s`
    );

    // ── Streaming state ────────────────────────────────────────
    const state = {
      content:          "",
      reasoningContent: "",
      tokensUsed:       0,
      rawBuffer:        "",    // incomplete SSE line buffer
    };

    let firstChunkSeen = false;
    let settled        = false;

    let firstChunkTimer = null;
    let idleTimer       = null;

    // ── Helpers ────────────────────────────────────────────────
    function cleanup() {
      if (firstChunkTimer) { clearTimeout(firstChunkTimer); firstChunkTimer = null; }
      if (idleTimer)       { clearTimeout(idleTimer);       idleTimer       = null; }
    }

    function safeResolve(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    function safeReject(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    // ── First-chunk timeout ────────────────────────────────────
    firstChunkTimer = setTimeout(() => {
      safeReject(
        new Error(
          `No response from NVIDIA after ${CONFIG.firstChunkTimeoutMs / 1000}s. ` +
          `Model may be under load — try again.`
        )
      );
    }, CONFIG.firstChunkTimeoutMs);

    // ── Make the HTTPS request ─────────────────────────────────
    const req = https.request(options, (res) => {
      console.log(`📡  ← HTTP Status: ${res.statusCode}`);

      // Non-2xx — collect error body then reject
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errBody = "";
        res.on("data", (chunk) => (errBody += chunk));
        res.on("end", () => {
          console.error(`❌  Error body: ${errBody.slice(0, 500)}`);
          safeReject(
            new Error(
              `NVIDIA API error ${res.statusCode}: ${errBody.slice(0, 400)}`
            )
          );
        });
        return;
      }

      // ── Data chunks ────────────────────────────────────────
      res.on("data", (chunk) => {
        // Reset idle timer on every chunk
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          safeReject(
            new Error(
              `Stream stalled — no data for ${CONFIG.idleTimeoutMs / 1000}s`
            )
          );
        }, CONFIG.idleTimeoutMs);

        // Log when first chunk arrives
        if (!firstChunkSeen) {
          firstChunkSeen = true;
          clearTimeout(firstChunkTimer);
          firstChunkTimer = null;
          console.log(`📡  ← First chunk received — streaming…`);
        }

        // Append chunk to buffer
        state.rawBuffer += chunk.toString("utf8");

        // Split on newlines — process all complete lines
        const lines = state.rawBuffer.split("\n");

        // Last element may be incomplete — put back in buffer
        state.rawBuffer = lines.pop() || "";

        for (const line of lines) {
          processSSELine(line, state);
        }
      });

      // ── Stream end ─────────────────────────────────────────
      res.on("end", () => {
        // Process any remaining buffered content
        if (state.rawBuffer.trim()) {
          processSSELine(state.rawBuffer, state);
        }

        // Log reasoning summary
        if (state.reasoningContent) {
          console.log(
            `🧠  Reasoning (${state.reasoningContent.length} chars): ` +
            `${state.reasoningContent.slice(0, 120)}…`
          );
        }

        if (!state.content.trim()) {
          safeReject(
            new Error(
              "Model returned empty content. " +
              "Raw buffer sample: " + state.rawBuffer.slice(0, 200)
            )
          );
          return;
        }

        safeResolve({
          content:          state.content.trim(),
          reasoningContent: state.reasoningContent.trim(),
          tokensUsed:       state.tokensUsed,
          modelUsed:        CONFIG.model,
        });
      });

      res.on("error", (err) => {
        safeReject(new Error(`Response stream error: ${err.message}`));
      });
    });

    req.on("error", (err) => {
      safeReject(new Error(`HTTPS request error: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

// ── Response parser ────────────────────────────────────────────
// Strips any wrapping and extracts the JSON object from content.
function parseAIResponse(content) {
  let cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")   // strip think blocks
    .trim()
    .replace(/^```json\s*/i, "")                  // strip fences
    .replace(/^```\s*/,      "")
    .replace(/```\s*$/,      "")
    .trim();

  // Extract first complete JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace  = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `JSON parse failed: ${err.message}. ` +
      `Content was: ${cleaned.slice(0, 300)}`
    );
  }

  return {
    explanation: (parsed.explanation || "").trim().slice(0, 5000),
    suggestion:  (parsed.suggestion  || "").trim().slice(0, 5000),
  };
}

// ── Main exported function ─────────────────────────────────────
/**
 * Analyzes a failed execution using NVIDIA openai/gpt-oss-120b.
 *
 * @param {object} params
 * @param {string} params.language  "python"|"java"|"cpp"|"javascript"
 * @param {string} params.code      Source code that was executed
 * @param {string} params.error     stderr from the execution
 * @param {number} params.exitCode  Non-zero exit code
 *
 * @returns {Promise<{
 *   success:         boolean,
 *   explanation:     string,
 *   suggestion:      string,
 *   model:           string,
 *   tokensUsed:      number,
 *   reasoningTokens: number,
 *   error:           string
 * }>}
 *
 * Never throws — errors captured in return value.
 */
async function analyzeError({ language, code, error, exitCode }) {
  if (!CONFIG.enabled) {
    return {
      success:         false,
      explanation:     "",
      suggestion:      "",
      model:           "",
      tokensUsed:      0,
      reasoningTokens: 0,
      error:           "AI debugging is disabled (AI_ENABLED=false)",
    };
  }

  try {
    const { systemPrompt, userPrompt } = buildMessages(
      language, code, error, exitCode
    );

    console.log(
      `🤖  Calling NVIDIA ${CONFIG.model} ` +
      `for ${language} error analysis…`
    );

    const startTime = Date.now();
    const rawResult = await callNvidiaAI(systemPrompt, userPrompt);
    const elapsed   = Date.now() - startTime;

    const { explanation, suggestion } = parseAIResponse(rawResult.content);

    console.log(
      `✅  AI analysis complete in ${(elapsed / 1000).toFixed(1)}s — ` +
      `${rawResult.tokensUsed} tokens | ` +
      `reasoning: ${rawResult.reasoningContent?.length || 0} chars`
    );

    return {
      success:         true,
      explanation,
      suggestion,
      model:           rawResult.modelUsed,
      tokensUsed:      rawResult.tokensUsed,
      reasoningTokens: rawResult.reasoningContent?.length || 0,
      error:           "",
    };

  } catch (err) {
    console.error("❌  AI analysis failed:", err.message);

    return {
      success:         false,
      explanation:     "",
      suggestion:      "",
      model:           CONFIG.model,
      tokensUsed:      0,
      reasoningTokens: 0,
      error:           err.message,
    };
  }
}

module.exports = { analyzeError };