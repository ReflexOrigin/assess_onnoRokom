import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, UserCheck, ArrowRight, Clock } from 'lucide-react';
import { api, ApiException } from '../api/client';
import { ClassItem, HoldItem, StudentHoldSummary } from '../types';

interface Props {
  studentId: string;
  isStudentIdValid: boolean;
  onHoldCreated: (hold: HoldItem) => void;
  onSelectHold: (holdId: string) => void;
  onNavigateToAdmin?: () => void;
}

export const ClassListScreen: React.FC<Props> = ({
  studentId,
  isStudentIdValid,
  onHoldCreated,
  onSelectHold,
  onNavigateToAdmin,
}) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [myHolds, setMyHolds] = useState<StudentHoldSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);

  const isMounted = useRef(true);

  const fetchClasses = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const [classesData, holdsData] = await Promise.all([
        api.getClasses(),
        isStudentIdValid
          ? api.getMyHolds(studentId).catch(() => [] as StudentHoldSummary[])
          : Promise.resolve([] as StudentHoldSummary[]),
      ]);
      if (isMounted.current) {
        setClasses(classesData);
        setMyHolds(holdsData);
        setErrorMessage(null);
      }
    } catch (err: unknown) {
      if (isMounted.current) {
        if (err instanceof ApiException) {
          setErrorMessage(`Failed to load classes: ${err.message} (${err.code})`);
        } else {
          setErrorMessage('Could not connect to the backend server. Please verify the service is running.');
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        if (showRefreshIndicator) setIsRefreshing(false);
      }
    }
  }, [studentId, isStudentIdValid]);

  // Initial load and periodic polling every 4 seconds to keep seat availability and enrollments fresh
  useEffect(() => {
    isMounted.current = true;
    fetchClasses();

    const interval = setInterval(() => {
      fetchClasses();
    }, 4000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchClasses]);

  const handleApply = async (classItem: ClassItem) => {
    if (!isStudentIdValid) {
      setErrorMessage('Please provide a valid 17-digit Student Birth Registration Number in the top bar before applying.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setApplyingClassId(classItem.id);

    try {
      const hold = await api.createHold(classItem.id, studentId);
      setSuccessMessage(`Seat reserved successfully for ${classItem.name}!`);
      // Notify parent to transition to Hold Details screen
      onHoldCreated(hold);
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        if (err.code === 'NO_SEATS_AVAILABLE') {
          setErrorMessage(`Sorry, no seats are available for ${classItem.name}. All seats have been reserved.`);
        } else if (err.code === 'DUPLICATE_APPLICATION') {
          setErrorMessage(`You already have an active reservation or confirmed admission for ${classItem.name}.`);
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Failed to submit application. Please check your network connection.');
      }
      // Refresh class availability immediately
      fetchClasses();
    } finally {
      setApplyingClassId(null);
    }
  };

  return (
    <div>
      <div className="card-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className="card-title">
            Available Classes & Seat Capacities | শ্রেণি ও আসন তথ্য
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
            First-come, first-served admission. Seat availability updates automatically in real-time.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchClasses(true)}
          disabled={isLoading || isRefreshing}
          title="Refresh class seat statistics"
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

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {!isStudentIdValid && (
        <div className="alert alert-warning">
          <UserCheck size={18} />
          <span>
            <strong>Attention:</strong> Please enter and set your 17-digit student identity in the blue header above before applying for any class.
          </span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-500)' }}>
          <div className="spinner spinner-dark" style={{ width: '32px', height: '32px', marginBottom: '1rem' }} />
          <div>Loading class seat availability from server...</div>
        </div>
      ) : classes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <p style={{ color: 'var(--neutral-700)', fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            No classes have been registered yet for admission.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: '1.5rem' }}>
            School administration must first register classes and seat quotas before students can apply.
          </p>
          {onNavigateToAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onNavigateToAdmin}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>Open School Admin Portal to Register Classes</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="class-grid">
          {classes.map((cls) => {
            const isFull = cls.availableSeats <= 0;
            const isApplyingThis = applyingClassId === cls.id;
            const confirmedPercent = (cls.confirmedSeats / cls.totalSeats) * 100;
            const heldPercent = (cls.heldSeats / cls.totalSeats) * 100;

            // Check if currently selected student is enrolled or has an active hold in this class
            const classHolds = myHolds.filter((h) => h.classId === cls.id);
            const confirmedHold = classHolds.find((h) => h.status === 'CONFIRMED');
            const activeHold = classHolds.find(
              (h) => h.status === 'HELD' && new Date(h.expiresAt).getTime() > Date.now()
            );

            const isEnrolled = !!confirmedHold;
            const isHeld = !isEnrolled && !!activeHold;

            return (
              <div key={cls.id} className={`class-card ${isEnrolled ? 'enrolled' : isHeld ? 'held' : ''}`}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h3 className="class-title">{cls.name}</h3>
                    {isEnrolled ? (
                      <span className="badge badge-confirmed" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={13} />
                        <span>Enrolled / ভর্তি সম্পন্ন</span>
                      </span>
                    ) : isHeld ? (
                      <span className="badge badge-held" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={13} />
                        <span>Seat Reserved / সংরক্ষিত</span>
                      </span>
                    ) : isFull ? (
                      <span className="badge badge-expired">Full / পূর্ণ</span>
                    ) : (
                      <span className="badge badge-confirmed">Open / খালি আছে</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                    ID: {cls.id}
                  </div>

                  {/* Seat metrics */}
                  <div className="seats-metric-grid">
                    <div>
                      <div className="metric-label">Total</div>
                      <div className="metric-value">{cls.totalSeats}</div>
                    </div>
                    <div>
                      <div className="metric-label">Held</div>
                      <div className="metric-value held">{cls.heldSeats}</div>
                    </div>
                    <div>
                      <div className="metric-label">Confirmed</div>
                      <div className="metric-value confirmed">{cls.confirmedSeats}</div>
                    </div>
                    <div>
                      <div className="metric-label">Available</div>
                      <div className="metric-value available">{cls.availableSeats}</div>
                    </div>
                  </div>

                  {/* Visual progress bar */}
                  <div className="seat-progress-container" title={`Confirmed: ${cls.confirmedSeats}, Held: ${cls.heldSeats}, Available: ${cls.availableSeats}`}>
                    <div className="progress-confirmed" style={{ width: `${confirmedPercent}%` }} />
                    <div className="progress-held" style={{ width: `${heldPercent}%` }} />
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  {isEnrolled && confirmedHold ? (
                    <button
                      type="button"
                      className="btn btn-success"
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                      }}
                      onClick={() => onSelectHold(confirmedHold.holdId)}
                      title="View your confirmed admission details"
                    >
                      <CheckCircle2 size={16} />
                      <span>Enrolled • View Admission Details</span>
                    </button>
                  ) : isHeld && activeHold ? (
                    <button
                      type="button"
                      className="btn btn-warning"
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                      }}
                      onClick={() => onSelectHold(activeHold.holdId)}
                      title="Continue to complete payment before timer expires"
                    >
                      <Clock size={16} />
                      <span>Reserved • Complete Payment</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      className={`btn ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ width: '100%' }}
                      disabled={isFull || isApplyingThis || !isStudentIdValid}
                      onClick={() => handleApply(cls)}
                    >
                      {isApplyingThis ? (
                        <>
                          <span className="spinner" />
                          <span>Reserving Seat...</span>
                        </>
                      ) : isFull ? (
                        <span>No Seats Available (আসন পূর্ণ)</span>
                      ) : (
                        <>
                          <span>Apply & Reserve Seat</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

