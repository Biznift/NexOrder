export type Env = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  STEADFAST_API_KEY?: string;
  STEADFAST_SECRET_KEY?: string;
  STEADFAST_BASE_URL?: string;
  STEADFAST_WEBHOOK_SECRET?: string;
  PATHAO_BASE_URL?: string;
  PATHAO_CLIENT_ID?: string;
  PATHAO_CLIENT_SECRET?: string;
  PATHAO_USERNAME?: string;
  PATHAO_PASSWORD?: string;
  REDX_BASE_URL?: string;
  REDX_API_TOKEN?: string;
  CARRYBEE_BASE_URL?: string;
  CARRYBEE_API_KEY?: string;
  CARRYBEE_SECRET_KEY?: string;
  /** Comma-separated allowed origins. Required in production. */
  CORS_ORIGIN?: string;
  /** Min 16 chars. Required in production. */
  AUTH_SECRET?: string;
  /** Set to "production" on Workers deploy. */
  ENVIRONMENT?: string;
  /** Dev-only: allow Steadfast webhooks without secret when "true". */
  ALLOW_INSECURE_WEBHOOK?: string;
  /** Dev-only: enable simulate-webhook when "true". */
  ALLOW_SIMULATE_WEBHOOK?: string;
};
