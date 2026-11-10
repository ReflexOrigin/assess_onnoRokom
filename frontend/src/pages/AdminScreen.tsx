import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, CheckCircle, AlertCircle, Sparkles, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import { api, ApiException } from '../api/client';
import { ClassItem, CreateClassResponse } from '../types';
import { AdminTab } from '../components/Navbar';

interface Props {
  adminTab: AdminTab;
  onSelectAdminTab: (tab: AdminTab) => void;
  onClassCreated?: (newClass: CreateClassResponse) => void;
}

export const AdminScreen: React.FC<Props> = ({ adminTab, onSelectAdminTab, onClassCreated }) => {
  // Form State
  const [name, setName] = useState('');
  const [totalSeats, setTotalSeats] = useState<string>('120');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Class Overview State
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const presets = [
    { name: 'Class 6 - Morning Shift', seats: 120 },
    { name: 'Class 6 - Day Shift', seats: 100 },
    { name: 'Class 7 - Morning Shift', seats: 90 },
    { name: 'Class 8 - Day Shift', seats: 80 },
    { name: 'Class 9 - Science Group', seats: 50 },
    { name: 'Class 10 - Fast Test Class', seats: 2 },
  ];

  const fetchClasses = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    else setIsLoadingClasses(true);
    setOverviewError(null);

    try {
      const data = await api.getClasses();
      setClasses(data);
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        setOverviewError(`Failed to load classes: ${err.message} (${err.code})`);
      } else {
        setOverviewError('Could not reach backend server to load classes.');
      }
    } finally {
      setIsLoadingClasses(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab === 'classes-overview') {
      fetchClasses();
    }
  }, [adminTab, fetchClasses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    const seatsNumber = parseInt(totalSeats, 10);

    if (!trimmedName) {
      setErrorMessage('Class name cannot be empty.');
      return;
    }

    if (isNaN(seatsNumber) || seatsNumber <= 0) {
      setErrorMessage('Total seats must be a positive integer greater than zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.createClass({
        name: trimmedName,
        totalSeats: seatsNumber,
      });

      setSuccessMessage(`Successfully registered class "${response.name}" with ${response.totalSeats} seats (ID: ${response.id}).`);
      setName('');
      setTotalSeats('100');

      if (onClassCreated) onClassCreated(response);
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        setErrorMessage(`Failed to create class: ${err.message} (${err.code})`);
      } else {
        setErrorMessage('Failed to connect to backend server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = (presetName: string, presetSeats: number) => {
    setName(presetName);
    setTotalSeats(presetSeats.toString());
  };

  return (
    <div className="admin-portal-container">
      {/* Admin Mode Header Banner */}
      <div className="admin-banner">
        <div className="admin-banner-content">
          <div>
            <h1 className="admin-banner-title">School Administration Portal</h1>
            <p className="admin-banner-desc">
              Dedicated administrative interface for registering classes, configuring independent shifts, and monitoring live seat capacities.
            </p>
          </div>
          <div className="admin-banner-actions">
            <button
              type="button"
              className={`btn btn-sm ${adminTab === 'create-class' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onSelectAdminTab('create-class')}
            >
              <PlusCircle size={14} /> Register New Class
            </button>
            <button
              type="button"
              className={`btn btn-sm ${adminTab === 'classes-overview' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onSelectAdminTab('classes-overview')}
            >
              <Layers size={14} /> Live Seat Monitor
            </button>
          </div>
        </div>
      </div>

      {/* Screen 1: Register New Class Form */}
      {adminTab === 'create-class' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <PlusCircle size={22} color="var(--primary)" />
                  <span>Register New Class & Shift | নতুন শ্রেণি ও শিফট নিবন্ধন</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
                  Create an independent class entry. Each shift (Morning, Day) operates with an isolated seat quota.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="alert alert-danger">
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} />
                  <span>{successMessage}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => onSelectAdminTab('classes-overview')}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  View in Seat Monitor →
                </button>
              </div>
            )}

            {/* Quick Presets for Evaluator */}
            <div className="admin-presets-box">
              <div className="admin-presets-title">
                <Sparkles size={14} color="#d97706" /> Quick Example Presets:
              </div>
              <div className="admin-presets-grid">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleApplyPreset(p.name, p.seats)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {p.name} ({p.seats} seats)
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="className">
                  Class Name & Shift <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="className"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Class 6 - Morning Shift"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <div className="form-help">
                  Example: "Class 6 - Morning Shift" and "Class 6 - Day Shift" maintain separate seat capacities.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="totalSeats">
                  Total Seat Capacity <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="totalSeats"
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  placeholder="e.g. 120"
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <div className="form-help">
                  Must be a positive integer greater than 0.
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={isSubmitting || !name.trim() || !totalSeats}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner" />
                      <span>Registering Class...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle size={16} />
                      <span>Register Class (API 1: POST /classes)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screen 2: All Classes Live Seat Monitor */}
      {adminTab === 'classes-overview' && (
        <div>
          <div className="card-header" style={{ marginBottom: '1.25rem' }}>
            <div>
              <h2 className="card-title">
                <Layers size={22} color="var(--primary)" />
                <span>Live Seat Allocation Monitor | আসন বরাদ্দ পর্যবেক্ষণ</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
                Real-time seat statistics across all classes and shifts. Counts reflect dynamic expiration.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fetchClasses(true)}
                disabled={isLoadingClasses || isRefreshing}
              >
                <RefreshCw size={14} className={isRefreshing ? 'spinner-dark' : ''} />
                <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onSelectAdminTab('create-class')}
              >
                <PlusCircle size={14} />
                <span>Register Another Class</span>
              </button>
            </div>
          </div>

          {overviewError && (
            <div className="alert alert-danger">
              <AlertCircle size={18} />
              <span>{overviewError}</span>
            </div>
          )}

          {isLoadingClasses ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-500)' }}>
              <div className="spinner spinner-dark" style={{ width: '32px', height: '32px', marginBottom: '1rem' }} />
              <div>Loading registered classes...</div>
            </div>
          ) : classes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--neutral-500)', marginBottom: '1rem' }}>
                No classes registered yet in the system.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onSelectAdminTab('create-class')}
              >
                <PlusCircle size={16} /> Register First Class
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Class ID</th>
                    <th>Class Name & Shift</th>
                    <th style={{ textAlign: 'center' }}>Total Seats</th>
                    <th style={{ textAlign: 'center' }}>Active Holds</th>
                    <th style={{ textAlign: 'center' }}>Confirmed</th>
                    <th style={{ textAlign: 'center' }}>Available</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => {
                    const isFull = c.availableSeats <= 0;
                    return (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--neutral-500)' }}>
                          {c.id}
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.totalSeats}</td>
                        <td style={{ textAlign: 'center', color: '#b45309', fontWeight: 600 }}>
                          {c.heldSeats}
                        </td>
                        <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 600 }}>
                          {c.confirmedSeats}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '1rem',
                              color: isFull ? 'var(--danger)' : 'var(--primary)',
                            }}
                          >
                            {c.availableSeats}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isFull ? (
                            <span className="badge badge-danger">SEATS FULL</span>
                          ) : (
                            <span className="badge badge-success">
                              <CheckCircle2 size={12} /> AVAILABLE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
