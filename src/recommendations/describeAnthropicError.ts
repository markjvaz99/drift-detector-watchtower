import Anthropic from "@anthropic-ai/sdk";

export function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "That API key was rejected. Check it and try again.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Rate limited by the Anthropic API. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the Anthropic API — check your connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error: ${err.message}`;
  }
  if (err instanceof Anthropic.AnthropicError && /parse structured output/i.test(err.message)) {
    return "Claude's response got cut off before it finished (likely hit the output length limit). Try again.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong.";
}
