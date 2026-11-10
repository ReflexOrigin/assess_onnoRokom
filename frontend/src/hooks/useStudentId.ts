import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'school_admission_student_id';
const SEVENTEEN_DIGITS_REGEX = /^\d{17}$/;

export interface UseStudentIdResult {
  studentId: string;
  isValid: boolean;
  error: string | null;
  updateStudentId: (value: string) => void;
  clearStudentId: () => void;
}

export function useStudentId(): UseStudentIdResult {
  const [studentId, setStudentIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((val: string): { valid: boolean; err: string | null } => {
    const trimmed = val.trim();
    if (!trimmed) {
      return { valid: false, err: 'Please enter a 17-digit Birth Registration Number.' };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, err: 'Student ID must only contain numeric digits (0-9).' };
    }
    if (trimmed.length !== 17) {
      return {
        valid: false,
        err: `Student ID must be exactly 17 digits. Currently entered: ${trimmed.length} digits.`,
      };
    }
    return { valid: true, err: null };
  }, []);

  useEffect(() => {
    if (studentId) {
      const { err } = validate(studentId);
      setError(err);
    } else {
      setError(null);
    }
  }, [studentId, validate]);

  const updateStudentId = useCallback(
    (newVal: string) => {
      const trimmed = newVal.trim();
      setStudentIdState(trimmed);
      try {
        if (trimmed) {
          localStorage.setItem(STORAGE_KEY, trimmed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Failed to access localStorage', e);
      }
    },
    []
  );

  const clearStudentId = useCallback(() => {
    setStudentIdState('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to access localStorage', e);
    }
  }, []);

  const isValid = SEVENTEEN_DIGITS_REGEX.test(studentId);

  return {
    studentId,
    isValid,
    error,
    updateStudentId,
    clearStudentId,
  };
}

