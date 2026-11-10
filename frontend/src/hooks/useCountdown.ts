import { useState, useEffect, useRef } from 'react';

export interface CountdownState {
  secondsRemaining: number;
  formattedTime: string;
  isExpired: boolean;
}

export function useCountdown(expiresAtIso: string, onExpire?: () => void): CountdownState {
  const calculateSecondsLeft = (): number => {
    if (!expiresAtIso) return 0;
    const target = new Date(expiresAtIso).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((target - now) / 1000));
  };

  const [secondsRemaining, setSecondsRemaining] = useState<number>(calculateSecondsLeft);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const hasFiredExpire = useRef(false);

  useEffect(() => {
    hasFiredExpire.current = false;
    const initial = calculateSecondsLeft();
    setSecondsRemaining(initial);

    if (initial <= 0) {
      if (!hasFiredExpire.current && onExpireRef.current) {
        hasFiredExpire.current = true;
        onExpireRef.current();
      }
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasFiredExpire.current && onExpireRef.current) {
          hasFiredExpire.current = true;
          onExpireRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAtIso]);

  const formatTime = (secs: number): string => {
    if (secs <= 0) return '00:00';
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    const paddedM = String(minutes).padStart(2, '0');
    const paddedS = String(seconds).padStart(2, '0');
    return `${paddedM}:${paddedS}`;
  };

  return {
    secondsRemaining,
    formattedTime: formatTime(secondsRemaining),
    isExpired: secondsRemaining <= 0,
  };
}

