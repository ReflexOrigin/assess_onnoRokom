import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, ShieldCheck, DollarSign, Ban } from 'lucide-react';
import { api, ApiException } from '../api/client';
import { HoldDetails, HoldStatus } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';

interface Props {
  holdId: string;
  studentId: string;
  onBack: () => void;
  onHoldUpdated?: () => void;
}

export const ApplicationDetailsScreen: React.FC<Props> = ({
  holdId,
  studentId,
  onBack,
  onHoldUpdated,
}) => {
  const [hold, setHold] = useState<HoldDetails | null>(null);
  const [className, setClassName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMounted = useRef(true);

  const loadHoldDetails = useCallback(async () => {
    try {
      const data = await api.getHoldById(holdId);
      if (isMounted.current) {
        setHold(data);
        // Also fetch class details to show class name
        try {
          const classData = await api.getClassById(data.classId);
          if (isMounted.current) setClassName(classData.name);
        } catch {
          // Non-critical if class name lookup fails
        }
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        if (err instanceof ApiException) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Failed to load reservation details.');
        }
      }
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [holdId]);

  useEffect(() => {
    isMounted.current = true;
    loadHoldDetails();
    return () => {
      isMounted.current = false;
    };
  }, [loadHoldDetails]);

  // When countdown timer hits 0
  const handleCountdownExpire = useCallback(() => {
    if (hold && hold.status === 'HELD') {
      setHold((prev) => (prev ? { ...prev, status: 'EXPIRED' } : null));
      setErrorMessage('The reservation hold has expired. The reserved seat has been returned to the public pool.');
      // Sync with backend
      api.getHoldById(holdId).then((updated) => {
        if (isMounted.current) {
          setHold(updated);
        }
      }).catch(() => {});
      if (onHoldUpdated) onHoldUpdated();
    }
  }, [hold, holdId, onHoldUpdated]);

  const handleConfirm = async () => {
    if (!hold) return;
    setIsConfirming(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.confirmHold(hold.holdId, studentId);
      setHold((prev) => (prev ? { ...prev, status: res.status } : null));
      setSuccessMessage('Payment successful! Admission confirmed successfully.');
      if (onHoldUpdated) onHoldUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        if (err.code === 'HOLD_EXPIRED') {
          setErrorMessage('Cannot confirm admission: The reservation hold has expired and the seat was released.');
          setHold((prev) => (prev ? { ...prev, status: 'EXPIRED' } : null));
        } else if (err.code === 'UNAUTHORIZED_ACCESS') {
          setErrorMessage('Authorization error: You do not own this application reservation.');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Failed to confirm admission due to network error.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!hold) return;
    if (!window.confirm('Are you sure you want to cancel this reservation? The seat will be made immediately available for other students.')) {
      return;
    }

    setIsCancelling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.cancelHold(hold.holdId, studentId);
      setHold((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      setSuccessMessage('Reservation cancelled. The seat has been released.');
      if (onHoldUpdated) onHoldUpdated();
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to cancel reservation due to network error.');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner spinner-dark" style={{ width: '32px', height: '32px', marginBottom: '1rem' }} />
        <div>Loading reservation details...</div>
      </div>
    );
  }

  if (!hold) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <AlertCircle size={36} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
        <h3>Reservation Not Found</h3>
        <p style={{ color: 'var(--neutral-500)', margin: '1rem 0' }}>
          Could not locate hold ID: <code style={{ fontFamily: 'monospace' }}>{holdId}</code>
        </p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Return
        </button>
      </div>
    );
  }

  const renderStatusBadge = (status: HoldStatus) => {
    switch (status) {
      case 'HELD':
        return <span className="badge badge-held"><Clock size={12} /> HELD (আসন সাময়িক সংরক্ষিত)</span>;
      case 'CONFIRMED':
        return <span className="badge badge-confirmed"><CheckCircle size={12} /> CONFIRMED (ভর্তি নিশ্চিত)</span>;
      case 'EXPIRED':
        return <span className="badge badge-expired"><AlertCircle size={12} /> EXPIRED (মেয়াদোত্তীর্ণ)</span>;
      case 'CANCELLED':
        return <span className="badge badge-cancelled"><XCircle size={12} /> CANCELLED (বাতিলকৃত)</span>;
    }
  };

  const isHeld = hold.status === 'HELD';
  const isConfirmed = hold.status === 'CONFIRMED';
  const isExpired = hold.status === 'EXPIRED';
  const isCancelled = hold.status === 'CANCELLED';

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <ShieldCheck size={22} color="var(--primary)" />
              <span>Application Details | আবেদনের বিবরণ</span>
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
              Hold Reference: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{hold.holdId}</span>
            </div>
          </div>
          <div>{renderStatusBadge(hold.status)}</div>
        </div>

        {errorMessage && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <CheckCircle size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Live Countdown if status is HELD */}
        {isHeld && (
          <CountdownTimer expiresAt={hold.expiresAt} onExpire={handleCountdownExpire} />
        )}

        {isConfirmed && (
          <div className="alert alert-success" style={{ margin: '1.25rem 0' }}>
            <CheckCircle size={20} />
            <div>
              <strong>Admission Confirmed!</strong>
              <div style={{ fontSize: '0.85rem' }}>
                Your admission seat is officially confirmed and registered in the school database.
              </div>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="alert alert-warning" style={{ margin: '1.25rem 0' }}>
            <AlertCircle size={20} />
            <div>
              <strong>Reservation Expired</strong>
              <div style={{ fontSize: '0.85rem' }}>
                The payment deadline for this reservation has passed. The held seat was automatically released.
              </div>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="alert alert-danger" style={{ margin: '1.25rem 0' }}>
            <XCircle size={20} />
            <div>
              <strong>Reservation Cancelled</strong>
              <div style={{ fontSize: '0.85rem' }}>
                This application hold was cancelled by the applicant.
              </div>
            </div>
          </div>
        )}

        {/* Details Table */}
        <table className="table" style={{ margin: '1rem 0' }}>
          <tbody>
            <tr>
              <th style={{ width: '35%' }}>Class Name</th>
              <td style={{ fontWeight: 600 }}>{className || hold.classId}</td>
            </tr>
            <tr>
              <th>Class ID</th>
              <td style={{ fontFamily: 'monospace' }}>{hold.classId}</td>
            </tr>
            <tr>
              <th>Hold ID</th>
              <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{hold.holdId}</td>
            </tr>
            <tr>
              <th>Applicant Student ID</th>
              <td style={{ fontFamily: 'monospace' }}>{studentId}</td>
            </tr>
            <tr>
              <th>Expiration Deadline</th>
              <td>{new Date(hold.expiresAt).toLocaleString()} (UTC)</td>
            </tr>
            <tr>
              <th>Current Status</th>
              <td>{renderStatusBadge(hold.status)}</td>
            </tr>
          </tbody>
        </table>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {isHeld && (
            <>
              <button
                className="btn btn-success"
                style={{ flex: 1, minWidth: '220px' }}
                disabled={isConfirming || isCancelling}
                onClick={handleConfirm}
              >
                {isConfirming ? (
                  <>
                    <span className="spinner" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <DollarSign size={16} />
                    <span>Pay Fee & Confirm Admission</span>
                  </>
                )}
              </button>

              <button
                className="btn btn-danger"
                style={{ minWidth: '150px' }}
                disabled={isConfirming || isCancelling}
                onClick={handleCancel}
              >
                {isCancelling ? (
                  <>
                    <span className="spinner" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <Ban size={16} />
                    <span>Cancel Reservation</span>
                  </>
                )}
              </button>
            </>
          )}

          {!isHeld && (
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onBack}>
              <ArrowLeft size={16} /> Return to Class List
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

