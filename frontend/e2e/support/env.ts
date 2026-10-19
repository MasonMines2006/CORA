/**
 * Settings for the e2e run. Every one has a default that matches the local
 * Docker dev stack (docker-compose.dev.yml), so `yarn e2e` needs no flags.
 */

/** Where the frontend is served. The backend is reached through its `/api` proxy. */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
export const API_URL = process.env.E2E_API_URL ?? `${BASE_URL}/api`;

/** Container names, used to create invite links and clean up test rows. */
export const BACKEND_CONTAINER = process.env.E2E_BACKEND_CONTAINER ?? 'backend-dev';
export const POSTGRES_CONTAINER = process.env.E2E_POSTGRES_CONTAINER ?? 'postgres-dev';
export const POSTGRES_USER = process.env.POSTGRES_USER ?? 'cora';
export const POSTGRES_DB = process.env.POSTGRES_DB ?? 'cora_users';

/**
 * Every account the tests make uses this domain, so cleanup can find them all
 * (and never touches a real person's account). `.local` can't receive mail.
 */
export const TEST_EMAIL_DOMAIN = 'e2e.cora.local';

/** Set E2E_REAL_LLM=1 to also run the one test that calls the real model. */
export const REAL_LLM = process.env.E2E_REAL_LLM === '1';
