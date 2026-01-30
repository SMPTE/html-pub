import validator from "html-validator";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  // Resolve doc path relative to repo root (scripts/ -> ../doc/main.html)
  const htmlPath = path.resolve(__dirname, "../doc/main.html");
  const html = await readFile(htmlPath, "utf8");

  const options = {
    data: html,
    format: "json",
  };

  try {
    const result = await validator(options);

    if (typeof result === "string") {
      // Some versions/configs may return text. Default to silence unless warnings are requested.
      if (process.env.HTML_VALIDATE_WARNINGS === "1") {
        console.log(result);
      }
      // Best-effort failure detection for text output
      if (/\berror:\b/i.test(result) || /\bError\b/i.test(result)) process.exit(1);
      return;
    }

    // Normalize output across validators.
    // - Nu validator (via `html-validator`) returns { messages: [...] } where message.type is "error" or "info".
    // - Some other tools return { errors: [...] } where severity 2=error, 1=warning.
    const issues = Array.isArray(result?.messages)
      ? result.messages
      : (Array.isArray(result?.errors) ? result.errors : []);

    const isError = (m) => m?.type === "error" || m?.severity === 2;
    const isWarning = (m) => m?.type === "info" || m?.severity === 1 || m?.subType === "warning";

    const realErrors = issues.filter(isError);
    const warnings = issues.filter(m => !isError(m) && isWarning(m));

    // Default: print nothing unless we have real errors.
    if (realErrors.length > 0) {
      console.error(
        JSON.stringify(
          {
            errorCount: realErrors.length,
            errors: realErrors,
            // Keep warnings out of the default output, but capture the count for debugging.
            warningCount: warnings.length
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    // Opt-in: show warnings (and only warnings) when requested.
    if (process.env.HTML_VALIDATE_WARNINGS === "1" && warnings.length > 0) {
      console.warn(
        JSON.stringify(
          {
            warningCount: warnings.length,
            warnings
          },
          null,
          2
        )
      );
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();