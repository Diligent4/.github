/**
 * Diligent4 canonical TypeScript ESLint rules.
 *
 * Fetched at CI start by reusable-lint-node.yml from
 * Diligent4/.github/configs/typescript-eslint-rules.js, written into the
 * consumer workspace as `.canonical-eslint-rules.js`. Consumers' flat
 * `eslint.config.{js,mjs}` import named exports and spread them into rule
 * blocks.
 *
 * Usage in consumer:
 *
 *   import { boundaryRules, baseTsRules } from './.canonical-eslint-rules.js'
 *   import tseslint from '@typescript-eslint/eslint-plugin'
 *   import tsparser from '@typescript-eslint/parser'
 *
 *   export default [
 *     {
 *       files: ['src/** /*.ts'],
 *       languageOptions: { parser: tsparser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
 *       plugins: { '@typescript-eslint': tseslint },
 *       rules: { ...baseTsRules, ...boundaryRules },
 *     },
 *     // per-repo blocks (Next config, file-specific exceptions, etc.)
 *   ]
 *
 * Why these rules exist:
 * - All LLM API keys live in Google Secret Manager. Direct env reads bypass
 *   the BYOK + per-org resolution path in @flingoos/shared/llm.
 * - All blob/bucket access goes through impersonation/SAS-URL helpers in
 *   @flingoos/shared/storage for per-org bucket routing and audit.
 * - Telemetry and cost attribution wire into the shared package, not raw SDKs.
 *
 * NOT banned: firebase-admin, @google-cloud/firestore — Firestore stays direct.
 *
 * Legitimate per-file exceptions (document the bypass reason inline in the
 * consumer's eslint.config.js):
 *   - Customer API-key validation routes (key not yet in Secret Manager)
 *   - Server-only wrappers that legitimately encapsulate the banned SDK
 *   - Test fixtures that read env to toggle behavior
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

/**
 * Diligent4 boundary rules — applies the LLM/storage isolation as standard
 * ESLint rules. Spread into a flat-config rules block.
 */
export const boundaryRules = {
  'no-restricted-imports': ['error', NO_DIRECT_LLM_OR_STORAGE_IMPORTS],
  'no-restricted-syntax': ['error', ...NO_LLM_ENV_READS],
};

/**
 * Diligent4 base TypeScript rules — minimal, fleet-wide. Per-repo configs
 * add framework-specific rules (Next, React, etc.) on top.
 */
export const baseTsRules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
};
