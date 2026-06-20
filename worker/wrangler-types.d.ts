// Minimal ambient declaration for the Cloudflare Email send binding.
interface SendEmail {
  send(message: import("cloudflare:email").EmailMessage): Promise<void>;
}
