import { SourceListServerData, UserCredentials } from '../types';
import api, { createCredentialsFormData } from '../API/Index';
export const getSourceNodes = async (userCredentials: UserCredentials) => {
  try {
    const formdata = createCredentialsFormData(userCredentials);
    const response = await api.post<SourceListServerData>(`/sources_list`, formdata);
    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

/**
 * Student/guest variant of `getSourceNodes`.
 *
 * The student frontend (and anonymous guests arriving via the QR code) never holds Neo4j
 * credentials - the backend reads them from its own environment for this route - so this
 * sends an empty body instead of a credentials FormData. Auth is handled centrally by the
 * axios interceptor in API/Index.ts (Auth0 bearer token, or X-Guest-Id for guests).
 */
export const getServerSourceNodes = async (signal?: AbortSignal) => {
  const response = await api.post<SourceListServerData>(`/sources_list`, new FormData(), { signal });
  return response;
};
