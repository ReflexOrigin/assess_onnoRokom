import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountdownTimer } from '../components/CountdownTimer';

describe('CountdownTimer Component', () => {
  it('renders countdown box for active deadline', () => {
    const futureDate = new Date(Date.now() + 600 * 1000).toISOString();
    render(<CountdownTimer expiresAt={futureDate} />);

    expect(screen.getByText(/Admission Hold Reservation Countdown/i)).toBeInTheDocument();
    expect(screen.getByText(/09:59|10:00/)).toBeInTheDocument();
  });

  it('renders expired state for past timestamp', () => {
    const pastDate = new Date(Date.now() - 10000).toISOString();
    render(<CountdownTimer expiresAt={pastDate} />);

    expect(screen.getByText(/Reservation Hold Expired/i)).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('renders compact mode properly', () => {
    const futureDate = new Date(Date.now() + 60 * 1000).toISOString();
    render(<CountdownTimer expiresAt={futureDate} compact />);

    expect(screen.getByText(/00:59|01:00/)).toBeInTheDocument();
  });
});
