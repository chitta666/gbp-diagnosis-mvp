export function adminTokenMissingHelp(taskName, exampleCommand) {
  const command = String(exampleCommand || "").trim();
  return [
    `Set --token or FEEDBACK_ADMIN_TOKEN before running ${taskName}.`,
    "",
    "Safe setup:",
    "1. Set FEEDBACK_ADMIN_TOKEN in Cloudflare Pages environment variables for the production project.",
    "2. Use the same value locally as a one-off shell variable or pass it with --token.",
    "3. Do not commit the token to README, logs, PR descriptions, screenshots, or shell history shared publicly.",
    "",
    "Local examples:",
    command ? `- FEEDBACK_ADMIN_TOKEN=<token> ${command}` : "",
    command ? `- ${command} --token <token>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function printCliError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("Safe setup:")) {
    console.error(`Error: ${message}`);
    return;
  }

  console.error(error?.stack || message);
}
