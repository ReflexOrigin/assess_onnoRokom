import React, { useState } from 'react';
import { User, CheckCircle, AlertCircle, Edit2, Save, X } from 'lucide-react';
import { UseStudentIdResult } from '../hooks/useStudentId';

interface Props {
  studentState: UseStudentIdResult;
}

export const StudentIdentityBar: React.FC<Props> = ({ studentState }) => {
  const { studentId, isValid, error, updateStudentId } = studentState;
  const [isEditing, setIsEditing] = useState(!studentId || !isValid);
  const [inputValue, setInputValue] = useState(studentId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudentId(inputValue);
    if (/^\d{17}$/.test(inputValue.trim())) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setInputValue(studentId);
    if (isValid) {
      setIsEditing(false);
    }
  };

  return (
    <div className="student-bar-card">
      <div className="student-bar-inner">
        <div>
          <div className="student-bar-title">
            <User size={20} />
            <span>Applicant Identity | শিক্ষার্থীর জন্ম নিবন্ধন নম্বর</span>
          </div>
          <div className="student-bar-subtitle">
            17-digit Birth Registration Number is required to apply, confirm, and manage admission holds.
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="student-input-group">
            <div>
              <input
                type="text"
                className="student-input"
                placeholder="Enter 17-digit Birth Reg No (e.g. 20152691234567890)"
                value={inputValue}
                maxLength={17}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
              {inputValue && inputValue.length !== 17 && (
                <div className="student-error-msg">
                  {inputValue.length}/17 digits entered
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-sm btn-primary"
              style={{ backgroundColor: '#ffffff', color: '#1e3a8a' }}
              disabled={!/^\d{17}$/.test(inputValue.trim())}
            >
              <Save size={14} /> Set Student ID
            </button>

            {isValid && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', borderColor: 'transparent' }}
                onClick={handleCancel}
              >
                <X size={14} /> Cancel
              </button>
            )}
          </form>
        ) : (
          <div className="student-input-group">
            <div className="student-badge-display">
              <CheckCircle size={18} color="#4ade80" />
              <div>
                <span style={{ fontSize: '0.75rem', opacity: 0.9, display: 'block' }}>Active Student ID:</span>
                <span className="student-id-mono">{studentId}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)' }}
              onClick={() => {
                setInputValue(studentId);
                setIsEditing(true);
              }}
              title="Change active student identity"
            >
              <Edit2 size={14} /> Change Student
            </button>
          </div>
        )}
      </div>

      {error && !isEditing && (
        <div className="alert alert-danger" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

