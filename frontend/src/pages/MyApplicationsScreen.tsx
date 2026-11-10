import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle, Clock, CheckCircle, XCircle, ArrowRight, ClipboardList, ShieldAlert } from 'lucide-react';
import { api, ApiException } from '../api/client';
import { StudentHoldSummary, HoldStatus } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';

interface Props {
  studentId: string;
  isStudentIdValid: boolean;
  onSelectHold: (holdId: string) => void;
  onHoldsCountChange?: (count: number) => void;
}

export const MyApplicationsScreen: React.FC<Props> = ({
  studentId,
  isStudentIdValid,
  onSelectHold,
  onHoldsCountChange,
}) => {
  const [holds, setHolds] = useState<StudentHoldSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMounted = useRef(true);

  const fetchMyHolds = useCallback(async (showIndicator = false) => {
    if (!isStudentIdValid) {
      setIsLoading(false);
      return;
    }

    if (showIndicator) setIsRefreshing(true);

    try {
      const data = await api.getMyHolds(studentId);
      if (isMounted.current) {
        setHolds(data);
        setErrorMessage(null);
        if (onHoldsCountChange) onHoldsCountChange(data.length);
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        if (err instanceof ApiException) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to fetch applications for this student.');
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        if (showIndicator) setIsRefreshing(false);
      }
    }
  }, [studentId, isStudentIdValid, onHoldsCountChange]);

  useEffect(() => {
    isMounted.current = true;
    fetchMyHolds();

    // Auto-refresh every 5 seconds to update status across expiration
    const interval = setInterval(() => {
      fetchMyHolds();
    }, 5000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchMyHolds]);

  const renderBadge = (status: HoldStatus) => {
    switch (status) {
      case 'HELD':
        return <span className="badge badge-held"><Clock size={12} /> HELD</span>;
      case 'CONFIRMED':
        return <span className="badge badge-confirmed"><CheckCircle size={12} /> CONFIRMED</span>;
      case 'EXPIRED':
        return <span className="badge badge-expired"><AlertCircle size={12} /> EXPIRED</span>;
      case 'CANCELLED':
        return <span className="badge badge-cancelled"><XCircle size={12} /> CANCELLED</span>;
    }
  };

  if (!isStudentIdValid) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <ShieldAlert size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Student Identity Required</h3>
        <p style={{ color: 'var(--neutral-500)', maxWidth: '480px', margin: '0 auto' }}>
          Please set a valid 17-digit Student Birth Registration Number in the top identity bar to view your applications.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">
            <ClipboardList size={22} color="var(--primary)" />
            <span>My Applications & Holds | আমার আবেদনসমূহ</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
            Persistent history for student: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{studentId}</span>
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchMyHolds(true)}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spinner-dark' : ''} />
          <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-500)' }}>
          <div className="spinner spinner-dark" style={{ width: '32px', height: '32px', marginBottom: '1rem' }} />
          <div>Retrieving your application records...</div>
        </div>
      ) : holds.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--neutral-500)', marginBottom: '1rem' }}>
            No applications found for student ID <code style={{ fontFamily: 'monospace' }}>{studentId}</code>.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>
            Switch to "Browse Classes" to select a class and reserve a seat.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Hold Reference</th>
                  <th>Status</th>
                  <th>Remaining Time / Expiry</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holds.map((h) => {
                  const isHeld = h.status === 'HELD';
                  return (
                    <tr key={h.holdId}>
                      <td style={{ fontWeight: 600 }}>{h.className || h.classId}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{h.holdId}</td>
                      <td>{renderBadge(h.status)}</td>
                      <td>
                        {isHeld ? (
                          <CountdownTimer
                            expiresAt={h.expiresAt}
                            compact
                            onExpire={() => fetchMyHolds()}
                          />
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>
                            {new Date(h.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onSelectHold(h.holdId)}
                        >
                          <span>Manage</span>
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

