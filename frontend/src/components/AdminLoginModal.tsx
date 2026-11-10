import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, X, KeyRound, Eye, EyeOff } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<Props> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate credentials: username === 'admin' && password === 'admin'
    if (username.trim() === 'admin' && password === 'admin') {
      setUsername('');
      setPassword('');
      setErrorMessage(null);
      onLoginSuccess();
    } else {
      setErrorMessage('Invalid credentials. Username and password must be "admin".');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="modal-icon-badge">
              <Shield size={20} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--neutral-900)' }}>
                School Admin Authentication
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                প্রশাসন প্যানেল প্রবেশাধিকার | Restricted to authorized school personnel
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="alert alert-danger" style={{ margin: '1rem 1.25rem 0' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="admin-auth-hint" style={{ margin: '1rem 1.25rem 0' }}>
          <KeyRound size={14} color="#2563eb" />
          <span>
            <strong>Assessment Credentials:</strong> Username: <code>admin</code> | Password: <code>admin</code>
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-username">
              Admin Username
            </label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                id="admin-username"
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">
              Admin Password
            </label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: '2.4rem', paddingRight: '2.5rem' }}
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
            >
              <Lock size={15} />
              <span>Sign In to Admin</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

