import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudentId } from '../hooks/useStudentId';

describe('useStudentId Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty studentId when localStorage is empty', () => {
    const { result } = renderHook(() => useStudentId());
    expect(result.current.studentId).toBe('');
    expect(result.current.isValid).toBe(false);
  });

  it('validates exactly 17 digits correctly', () => {
    const { result } = renderHook(() => useStudentId());

    // Valid 17 digits
    act(() => {
      result.current.updateStudentId('20152691234567890');
    });
    expect(result.current.studentId).toBe('20152691234567890');
    expect(result.current.isValid).toBe(true);
    expect(result.current.error).toBeNull();
    expect(localStorage.getItem('school_admission_student_id')).toBe('20152691234567890');

    // 16 digits (too short)
    act(() => {
      result.current.updateStudentId('1234567890123456');
    });
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toContain('17 digits');

    // Non-numeric digits
    act(() => {
      result.current.updateStudentId('2015269123456789a');
    });
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toContain('numeric digits');
  });

  it('preserves leading zeros in studentId string', () => {
    const { result } = renderHook(() => useStudentId());
    const idWithZeros = '00152691234567890';
    act(() => {
      result.current.updateStudentId(idWithZeros);
    });
    expect(result.current.studentId).toBe(idWithZeros);
    expect(result.current.isValid).toBe(true);
  });

  it('clears student ID and removes from localStorage', () => {
    const { result } = renderHook(() => useStudentId());
    act(() => {
      result.current.updateStudentId('20152691234567890');
    });
    expect(localStorage.getItem('school_admission_student_id')).toBe('20152691234567890');

    act(() => {
      result.current.clearStudentId();
    });
    expect(result.current.studentId).toBe('');
    expect(result.current.isValid).toBe(false);
    expect(localStorage.getItem('school_admission_student_id')).toBeNull();
  });
});

