/**
 * Diligent4 canonical ESLint boundary rules — LLM and storage centralization.
 *
 * Synced from `Diligent4/.github/skills/diligent4-conventions/templates/eslint-boundary-rules.js`.
 * DO NOT edit in consumer repos. Update the canonical, then the sync workflow
 * opens PRs in each consumer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why these rules exist
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * - All LLM API keys live in Google Secret Manager (`apikeys-{provider}-_platform`).
 *   Direct env reads bypass the Secret Manager + BYOK resolution path in
 *   `@flingoos/shared/llm`.
 * - All blob/bucket access goes through impersonation / SAS-URL helpers in
 *   `@flingoos/shared/storage` for per-org bucket routing and audit.
 * - Telemetry and cost attribution are wired into the shared package, not into
 *   raw SDKs — bypassing means losing visibility.
 *
 * NOT banned: `firebase-admin` / `@google-cloud/firestore` — Firestore stays direct.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage (flat config, ESM)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import {
 *     NO_DIRECT_LLM_OR_STORAGE_IMPORTS,
 *     NO_LLM_ENV_READS,
 *   } from './eslint-boundary-rules.js';
 *
 *   export default [
 *     // ... your other config blocks (Next, TypeScript, etc.)
 *     {
 *       files: ['src/** /*.ts'],
 *       rules: {
 *         'no-restricted-imports': ['error', NO_DIRECT_LLM_OR_STORAGE_IMPORTS],
 *         'no-restricted-syntax': ['error', ...NO_LLM_ENV_READS],
 *       },
 *     },
 *   ];
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Legitimate per-file exceptions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Three known patterns where bypassing is correct (document the reason inline):
 *
 *   // 1. Customer API-key validation route — key isn't in Secret Manager yet.
 *   {
 *     files: ['src/app/api/admin/organizations/*\/api-keys/route.ts'],
 *     rules: {
 *       'no-restricted-imports': 'off',
 *       'no-restricted-syntax': 'off',
 *     },
 *   },
 *
 *   // 2. Server-only wrapper that legitimately encapsulates the banned SDK.
 *   {
 *     files: ['src/lib/utils/gcs-impersonated.ts'],
 *     rules: { 'no-restricted-imports': 'off' },
 *   },
 *
 *   // 3. Tests that read env to toggle behavior (no real call sites).
 *   {
 *     files: ['tests/** /*.ts'],
 *     rules: { 'no-restricted-syntax': 'off' },
 *   },
 *
 * Add new exceptions only when the bypass is *architecturally* legitimate,
 * not "I'm in a hurry". Each exception entry MUST have a comment explaining
 * why the rule does not apply.
 */

export const NO_DIRECT_LLM_OR_STORAGE_IMPORTS = {
  patterns: [
    {
      group: [
        'openai',
        'openai/*',
        '@anthropic-ai/sdk',
        '@anthropic-ai/sdk/*',
        '@anthropic-ai/bedrock-sdk',
        '@anthropic-ai/vertex-sdk',
        '@google/genai',
        '@google/genai/*',
        '@google/generative-ai',
        '@google-cloud/vertexai',
        'cohere-ai',
        '@mistralai/mistralai',
        'groq-sdk',
        'together-ai',
      ],
      message:
        'Import LLM SDKs through @flingoos/shared/llm (chat/streamChat/embed/vision/getRawClient) instead. The shared package handles BYOK key resolution, telemetry, and cost attribution.',
    },
    {
      group: [
        '@google-cloud/storage',
        '@google-cloud/storage/*',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-s3/*',
        '@aws-sdk/lib-storage',
        '@aws-sdk/lib-storage/*',
        '@azure/storage-blob',
        '@azure/storage-blob/*',
      ],
      message:
        'Import blob/bucket storage through @flingoos/shared/storage (getImpersonatedStorageClient / resolveOrgStorage / getFederatedBlobClient / getFederatedSasUrl) instead. The shared package handles per-org bucket resolution, impersonation, and SAS URLs. (Firestore via firebase-admin / @google-cloud/firestore is not banned.)',
    },
  ],
};

const LLM_API_KEY_NAMES =
  '/^(OPENAI|ANTHROPIC|GEMINI|GOOGLE_GENERATIVE_AI|COHERE|MISTRAL|GROQ|TOGETHER|REPLICATE)_API_KEY$/';

export const NO_LLM_ENV_READS = [
  {
    selector: `MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][property.name=${LLM_API_KEY_NAMES}]`,
    message:
      'Direct reads of LLM provider API keys are forbidden. Use @flingoos/shared/llm — it resolves keys via Secret Manager (BYOK) with platform fallback.',
  },
  {
    selector: `MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][computed=true][property.value=${LLM_API_KEY_NAMES}]`,
    message:
      'Direct reads of LLM provider API keys are forbidden. Use @flingoos/shared/llm — it resolves keys via Secret Manager (BYOK) with platform fallback.',
  },
];
