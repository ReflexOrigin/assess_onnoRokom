import React from 'react';
import { School, List, ClipboardList, PlusCircle, Shield, ArrowLeft, BarChart3, LogOut, UserCheck } from 'lucide-react';

export type PortalMode = 'student' | 'admin';
export type StudentTab = 'classes' | 'my-holds' | 'hold-details';
export type AdminTab = 'create-class' | 'classes-overview';

interface Props {
  portal: PortalMode;
  onSwitchPortal: (mode: PortalMode) => void;
  studentTab: StudentTab;
  onSelectStudentTab: (tab: StudentTab) => void;
  adminTab: AdminTab;
  onSelectAdminTab: (tab: AdminTab) => void;
  myHoldsCount?: number;
  isAdminAuthenticated: boolean;
  onAdminLogout: () => void;
}

export const Navbar: React.FC<Props> = ({
  portal,
  onSwitchPortal,
  studentTab,
  onSelectStudentTab,
  adminTab,
  onSelectAdminTab,
  myHoldsCount,
  isAdminAuthenticated,
  onAdminLogout,
}) => {
  return (
    <header className={`top-header ${portal === 'admin' ? 'top-header-admin' : ''}`}>
      <div className="header-content">
        {/* Brand Identity */}
        <div className="brand-wrapper">
          {portal === 'student' ? (
            <a
              href="#"
              className="brand"
              onClick={(e) => {
                e.preventDefault();
                onSelectStudentTab('classes');
              }}
            >
              <School className="brand-icon" />
              <div>
                <div className="brand-title">School Admission Portal</div>
                <span className="brand-subtitle">শিক্ষার্থী ও অভিভাবক কর্নার | Online Admission & Seat Reservation</span>
              </div>
            </a>
          ) : (
            <div className="brand brand-admin">
              <Shield className="brand-icon brand-icon-admin" />
              <div>
                <div className="brand-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>School Administration Portal</span>
                  <span className="admin-badge">ADMIN</span>
                </div>
                <span className="brand-subtitle">শ্রেণি ও আসন ধারণক্ষমতা ব্যবস্থাপনা | Class & Seat Capacity Management</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs & Portal Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {portal === 'student' ? (
            <nav className="nav-tabs" aria-label="Student Navigation">
              <button
                type="button"
                className={`nav-tab ${studentTab === 'classes' ? 'active' : ''}`}
                onClick={() => onSelectStudentTab('classes')}
              >
                <List size={16} />
                <span>Browse Classes & Seats</span>
              </button>

              <button
                type="button"
                className={`nav-tab ${studentTab === 'my-holds' ? 'active' : ''}`}
                onClick={() => onSelectStudentTab('my-holds')}
              >
                <ClipboardList size={16} />
                <span>My Applications</span>
                {myHoldsCount !== undefined && myHoldsCount > 0 && (
                  <span
                    style={{
                      backgroundColor: studentTab === 'my-holds' ? '#ffffff' : 'var(--primary)',
                      color: studentTab === 'my-holds' ? 'var(--primary)' : '#ffffff',
                      borderRadius: '9999px',
                      padding: '0.1rem 0.45rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      marginLeft: '0.2rem',
                    }}
                  >
                    {myHoldsCount}
                  </span>
                )}
              </button>
            </nav>
          ) : (
            <nav className="nav-tabs" aria-label="Admin Navigation">
              <button
                type="button"
                className={`nav-tab nav-tab-admin ${adminTab === 'create-class' ? 'active' : ''}`}
                onClick={() => onSelectAdminTab('create-class')}
              >
                <PlusCircle size={16} />
                <span>Register New Class</span>
              </button>

              <button
                type="button"
                className={`nav-tab nav-tab-admin ${adminTab === 'classes-overview' ? 'active' : ''}`}
                onClick={() => onSelectAdminTab('classes-overview')}
              >
                <BarChart3 size={16} />
                <span>Live Seat Monitor</span>
              </button>
            </nav>
          )}

          {/* Dedicated Portal Mode Switcher / Auth Actions */}
          <div className="portal-switch-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {portal === 'student' ? (
              <button
                type="button"
                className="btn-portal-switch"
                onClick={() => onSwitchPortal('admin')}
                title="Switch to School Admin Portal to register and manage classes"
              >
                <Shield size={14} />
                <span>School Admin Portal 🔐</span>
              </button>
            ) : (
              <>
                {isAdminAuthenticated && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: '#93c5fd',
                    }}
                  >
                    <UserCheck size={13} />
                    <span>admin</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-portal-switch btn-portal-switch-return"
                  onClick={onAdminLogout}
                  title="Sign out of Admin Portal"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>

                <button
                  type="button"
                  className="btn-portal-switch btn-portal-switch-return"
                  onClick={() => onSwitchPortal('student')}
                  title="Return to Student Admission Portal"
                >
                  <ArrowLeft size={14} />
                  <span>Exit to Admission Portal</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
