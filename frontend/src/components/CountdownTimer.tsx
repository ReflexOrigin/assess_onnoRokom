import React from 'react';
import { Clock } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';

interface Props {
  expiresAt: string;
  onExpire?: () => void;
  compact?: boolean;
}

export const CountdownTimer: React.FC<Props> = ({ expiresAt, onExpire, compact = false }) => {
  const { formattedTime, isExpired } = useCountdown(expiresAt, onExpire);

  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          color: isExpired ? '#dc2626' : '#d97706',
          fontSize: '0.85rem',
        }}
      >
        <Clock size={14} />
        {isExpired ? 'EXPIRED' : formattedTime}
      </span>
    );
  }

  return (
    <div className="countdown-box">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Clock size={20} color={isExpired ? '#dc2626' : '#b45309'} />
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: isExpired ? '#dc2626' : '#b45309' }}>
          {isExpired ? 'Reservation Hold Expired' : 'Admission Hold Reservation Countdown'}
        </span>
      </div>

      <div className="countdown-digits" style={{ color: isExpired ? '#dc2626' : '#b45309' }}>
        {isExpired ? '00:00' : formattedTime}
      </div>

      <div className="countdown-subtext">
        {isExpired
          ? 'The reservation deadline has passed. The seat has been released for other students.'
          : 'Please confirm admission and pay the fee before time runs out.'}
      </div>
    </div>
  );
};

