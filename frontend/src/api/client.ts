import {
  ClassItem,
  CreateClassPayload,
  CreateClassResponse,
  HoldDetails,
  HoldItem,
  ConfirmHoldResponse,
  StudentHoldSummary,
  ApiError,
} from '../types';

export class ApiException extends Error {
  public code: string;
  public status: number;

  constructor(status: number, error: ApiError) {
    super(error.message || `API request failed with status ${status}`);
    this.name = 'ApiException';
    this.code = error.code || 'UNKNOWN_ERROR';
    this.status = status;
  }
}

// Runtime or build-time API base URL resolution
declare global {
  interface Window {
    __ENV__?: {
      API_BASE_URL?: string;
    };
  }
}

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.__ENV__?.API_BASE_URL) {
    return window.__ENV__.API_BASE_URL.replace(/\/$/, '');
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  return 'http://localhost:8080';
};

export const API_BASE_URL = getBaseUrl();

async function request<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (studentId) {
    headers['X-Student-Id'] = studentId;
  }

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorData: ApiError = {
      code: `HTTP_${response.status}`,
      message: response.statusText,
    };

    try {
      const json = await response.json();
      if (json && (json.code || json.message)) {
        errorData = {
          code: json.code || errorData.code,
          message: json.message || errorData.message,
        };
      }
    } catch {
      // Body is not JSON
    }

    throw new ApiException(response.status, errorData);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // API 1: POST /classes
  createClass: (payload: CreateClassPayload): Promise<CreateClassResponse> =>
    request<CreateClassResponse>('/classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // API 2: GET /classes
  getClasses: (): Promise<ClassItem[]> =>
    request<ClassItem[]>('/classes', { method: 'GET' }),

  // API 3: GET /classes/{classId}
  getClassById: (classId: string): Promise<ClassItem> =>
    request<ClassItem>(`/classes/${encodeURIComponent(classId)}`, { method: 'GET' }),

  // API 4: POST /classes/{classId}/holds
  createHold: (classId: string, studentId: string): Promise<HoldItem> =>
    request<HoldItem>(
      `/classes/${encodeURIComponent(classId)}/holds`,
      { method: 'POST' },
      studentId
    ),

  // API 5: GET /holds/{holdId}
  getHoldById: (holdId: string): Promise<HoldDetails> =>
    request<HoldDetails>(`/holds/${encodeURIComponent(holdId)}`, { method: 'GET' }),

  // API 6: POST /holds/{holdId}/confirm
  confirmHold: (holdId: string, studentId: string): Promise<ConfirmHoldResponse> =>
    request<ConfirmHoldResponse>(
      `/holds/${encodeURIComponent(holdId)}/confirm`,
      { method: 'POST' },
      studentId
    ),

  // API 7: DELETE /holds/{holdId}
  cancelHold: (holdId: string, studentId: string): Promise<void> =>
    request<void>(
      `/holds/${encodeURIComponent(holdId)}`,
      { method: 'DELETE' },
      studentId
    ),

  // API 8: GET /me/holds
  getMyHolds: (studentId: string): Promise<StudentHoldSummary[]> =>
    request<StudentHoldSummary[]>('/me/holds', { method: 'GET' }, studentId),
};

