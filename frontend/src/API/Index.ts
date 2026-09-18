import axios from 'axios';
import { url } from '../utils/Utils';
import { UserCredentials } from '../types';
import { getOrCreateGuestId } from '../utils/guestSession';

const api = axios.create({
  baseURL: url(),
  data: {},
});

// --- Auth0 token attachment ---
// The backend now requires a bearer token on protected routes. This module has
// no access to React/Auth0 hooks directly, so a component mounted once near the
// app root (AuthTokenBridge in Auth.tsx) hands us a getter for the current token.
type TokenGetter = () => Promise<string | undefined>;
let getAuthToken: TokenGetter | null = null;

export const setAuthTokenGetter = (getter: TokenGetter | null) => {
  getAuthToken = getter;
};

api.interceptors.request.use(async (config) => {
  let hasBearerToken = false;
  if (getAuthToken) {
    try {
      const token = await getAuthToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
        hasBearerToken = true;
      }
    } catch {
      // Not authenticated (e.g. public landing page, or VITE_SKIP_AUTH mode) -
      // proceed without a token; the backend will 401 if the route needs one.
    }
  }
  if (!hasBearerToken) {
    const guestId = getOrCreateGuestId();
    if (guestId) {
      config.headers = config.headers ?? {};
      config.headers['X-Guest-Id'] = guestId;
    }
  }
  return config;
});

// Store credentials globally for the interceptor
let globalCredentials: UserCredentials | null = null;
let credentialsInterceptorId: number | null = null;

export const createDefaultFormData = (userCredentials: UserCredentials) => {
  // Store credentials for interceptor use
  globalCredentials = { ...userCredentials };

  // Eject only the previous credentials interceptor (not the auth one above)
  if (credentialsInterceptorId !== null) {
    api.interceptors.request.eject(credentialsInterceptorId);
  }

  // Add interceptor to automatically inject credentials into all requests
  credentialsInterceptorId = api.interceptors.request.use(
    (config) => {
      // Learning endpoints use typed JSON bodies and server-side Neo4j settings.
      // They must not be converted into the legacy credential FormData shape.
      if (config.url?.startsWith('/learning')) {
        return config;
      }
      if (globalCredentials && config.data instanceof FormData) {
        // Add credentials to FormData if not already present
        if (globalCredentials.uri && !config.data.has('uri')) {
          config.data.append('uri', globalCredentials.uri);
        }
        if (globalCredentials.database && !config.data.has('database')) {
          config.data.append('database', globalCredentials.database);
        }
        if (globalCredentials.userName && !config.data.has('userName')) {
          config.data.append('userName', globalCredentials.userName);
        }
        if (globalCredentials.password && !config.data.has('password')) {
          config.data.append('password', globalCredentials.password);
        }
        if (globalCredentials.email && !config.data.has('email')) {
          config.data.append('email', globalCredentials.email);
        }
      } else if (globalCredentials && !(config.data instanceof FormData)) {
        // Convert plain object to FormData and add credentials
        const formData = new FormData();

        // Add credentials first
        if (globalCredentials.uri) {
          formData.append('uri', globalCredentials.uri);
        }
        if (globalCredentials.database) {
          formData.append('database', globalCredentials.database);
        }
        if (globalCredentials.userName) {
          formData.append('userName', globalCredentials.userName);
        }
        if (globalCredentials.password) {
          formData.append('password', globalCredentials.password);
        }
        if (globalCredentials.email) {
          formData.append('email', globalCredentials.email);
        }

        // Add other data fields
        for (const [key, value] of Object.entries(config.data || {})) {
          formData.append(key, value as any);
        }

        config.data = formData;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Return a FormData with credentials for direct use if needed
  return createCredentialsFormData(userCredentials);
};

export const createCredentialsFormData = (userCredentials: UserCredentials): FormData => {
  const formData = new FormData();
  if (userCredentials?.uri) {
    formData.append('uri', userCredentials.uri);
  }
  if (userCredentials?.database) {
    formData.append('database', userCredentials.database);
  }
  if (userCredentials?.userName) {
    formData.append('userName', userCredentials.userName);
  }
  if (userCredentials?.password) {
    formData.append('password', userCredentials.password);
  }
  if (userCredentials?.email) {
    formData.append('email', userCredentials.email);
  }
  return formData;
};

export type LearningDifficulty = 'easy' | 'medium' | 'hard';

export interface LearningConcept {
  id: string;
  name: string;
  chunk_count: number;
  document_count: number;
  connectivity: number;
  sources: string[];
}

export interface LearningMastery {
  concept_id: string;
  attempts: number;
  correct: number;
  score: number;
  difficulty: LearningDifficulty;
}

export interface LearningConceptProgress {
  concept: LearningConcept;
  mastery: LearningMastery;
}

export interface LearningRecommendation extends LearningConceptProgress {
  reason: string;
}

export interface LearningDashboard {
  total_concepts: number;
  started_concepts: number;
  mastered_concepts: number;
  average_mastery: number;
  recommended: LearningRecommendation | null;
  concepts: LearningConceptProgress[];
}

export interface LearningSourcePassage {
  id: string;
  source: string;
  text: string;
}

export interface LearningSources {
  concept: LearningConcept;
  passages: LearningSourcePassage[];
}

export interface LessonBeat {
  key: 'core_idea' | 'how_it_works' | 'pulstar_application' | 'quick_check';
  title: string;
  content: string;
}

export interface QuickCheck {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}

export interface LearningLesson {
  concept: LearningConcept;
  beats: LessonBeat[];
  quick_check: QuickCheck;
  sources: string[];
  cached: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface LearningQuiz {
  quiz_id: string;
  concept: LearningConcept;
  difficulty: LearningDifficulty;
  mastery: LearningMastery;
  questions: QuizQuestion[];
  sources: string[];
  cached: boolean;
}

export interface GradedQuestion {
  id: string;
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
}

export interface QuizGrade {
  quiz_id: string;
  correct: number;
  total: number;
  results: GradedQuestion[];
  mastery: LearningMastery;
}

export const getLearningConcepts = async (signal?: AbortSignal): Promise<LearningConcept[]> => {
  const response = await api.get<LearningConcept[]>('/learning/concepts', { signal });
  return response.data;
};

export const getLearningDashboard = async (signal?: AbortSignal): Promise<LearningDashboard> => {
  const response = await api.get<LearningDashboard>('/learning/dashboard', { signal });
  return response.data;
};

export const getLearningSources = async (conceptId: string, signal?: AbortSignal): Promise<LearningSources> => {
  const response = await api.get<LearningSources>(`/learning/sources/${encodeURIComponent(conceptId)}`, { signal });
  return response.data;
};

export const getLearningMastery = async (conceptId: string, signal?: AbortSignal): Promise<LearningMastery> => {
  const response = await api.get<LearningMastery>(`/learning/mastery/${encodeURIComponent(conceptId)}`, { signal });
  return response.data;
};

export const getLearningLesson = async (conceptId: string, signal?: AbortSignal): Promise<LearningLesson> => {
  const response = await api.get<LearningLesson>(`/learning/lesson/${encodeURIComponent(conceptId)}`, { signal });
  return response.data;
};

export const generateLearningQuiz = async (conceptId: string, questionCount = 3): Promise<LearningQuiz> => {
  const response = await api.post<LearningQuiz>(
    '/learning/quiz/generate',
    { concept_id: conceptId, question_count: questionCount },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.data;
};

export const gradeLearningQuiz = async (quizId: string, answers: number[]): Promise<QuizGrade> => {
  const response = await api.post<QuizGrade>(
    '/learning/quiz/grade',
    { quiz_id: quizId, answers },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.data;
};

export default api;
