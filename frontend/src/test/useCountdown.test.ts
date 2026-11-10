import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../hooks/useCountdown';

describe('useCountdown Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates remaining seconds and formats time correctly', () => {
    const futureDate = new Date(Date.now() + 125 * 1000).toISOString(); // 2 minutes 5 seconds
    const { result } = renderHook(() => useCountdown(futureDate));

    expect(result.current.secondsRemaining).toBe(125);
    expect(result.current.formattedTime).toBe('02:05');
    expect(result.current.isExpired).toBe(false);
  });

  it('triggers onExpire callback and updates formattedTime when time runs out', () => {
    const onExpireMock = vi.fn();
    const futureDate = new Date(Date.now() + 3 * 1000).toISOString(); // 3 seconds
    const { result } = renderHook(() => useCountdown(futureDate, onExpireMock));

    expect(result.current.secondsRemaining).toBe(3);
    expect(result.current.isExpired).toBe(false);

    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.formattedTime).toBe('00:00');
    expect(result.current.isExpired).toBe(true);
    expect(onExpireMock).toHaveBeenCalledTimes(1);
  });

  it('handles already expired timestamps immediately', () => {
    const onExpireMock = vi.fn();
    const pastDate = new Date(Date.now() - 5000).toISOString();
    const { result } = renderHook(() => useCountdown(pastDate, onExpireMock));

    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.formattedTime).toBe('00:00');
    expect(result.current.isExpired).toBe(true);
    expect(onExpireMock).toHaveBeenCalledTimes(1);
  });
});

