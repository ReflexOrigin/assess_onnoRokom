import { useState, useCallback, useEffect } from 'react';
import { Navbar, PortalMode, StudentTab, AdminTab } from './components/Navbar';
import { StudentIdentityBar } from './components/StudentIdentityBar';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ClassListScreen } from './pages/ClassListScreen';
import { ApplicationDetailsScreen } from './pages/ApplicationDetailsScreen';
import { MyApplicationsScreen } from './pages/MyApplicationsScreen';
import { AdminScreen } from './pages/AdminScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStudentId } from './hooks/useStudentId';
import { HoldItem } from './types';

export function App() {
  const studentState = useStudentId();

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Distinct Portal Mode: 'student' (Public Admission Portal) vs 'admin' (School Administration)
  const [portal, setPortal] = useState<PortalMode>('student');

  // Navigation within Student Portal
  const [studentTab, setStudentTab] = useState<StudentTab>('classes');
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [myHoldsCount, setMyHoldsCount] = useState<number>(0);

  // Navigation within Admin Portal
  const [adminTab, setAdminTab] = useState<AdminTab>('create-class');

  // Ensure unauthenticated users cannot stay in admin portal if session expires
  useEffect(() => {
    if (portal === 'admin' && !isAdminAuthenticated) {
      setPortal('student');
    }
  }, [portal, isAdminAuthenticated]);

  const handleSwitchPortal = useCallback((target: PortalMode) => {
    if (target === 'admin' && !isAdminAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }
    setPortal(target);
  }, [isAdminAuthenticated]);

  const handleLoginSuccess = useCallback(() => {
    setIsAdminAuthenticated(true);
    sessionStorage.setItem('admin_authenticated', 'true');
    setIsLoginModalOpen(false);
    setPortal('admin');
  }, []);

  const handleAdminLogout = useCallback(() => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
    setPortal('student');
  }, []);

  const handleHoldCreated = useCallback((hold: HoldItem) => {
    setSelectedHoldId(hold.holdId);
    setStudentTab('hold-details');
    setMyHoldsCount((prev) => prev + 1);
  }, []);

  const handleSelectHold = useCallback((holdId: string) => {
    setSelectedHoldId(holdId);
    setStudentTab('hold-details');
  }, []);

  return (
    <ErrorBoundary>
      <div className={portal === 'admin' ? 'app-theme-admin' : ''}>
        <Navbar
          portal={portal}
          onSwitchPortal={handleSwitchPortal}
          studentTab={studentTab}
          onSelectStudentTab={setStudentTab}
          adminTab={adminTab}
          onSelectAdminTab={setAdminTab}
          myHoldsCount={myHoldsCount}
          isAdminAuthenticated={isAdminAuthenticated}
          onAdminLogout={handleAdminLogout}
        />

        <main className="app-container">
          {/* ============================================================== */}
          {/* STUDENT / PARENT PORTAL                                        */}
          {/* ============================================================== */}
          {portal === 'student' && (
            <>
              {/* Student Identity Bar - Shown ONLY in Student / Parent Portal */}
              <StudentIdentityBar studentState={studentState} />

              {studentTab === 'classes' && (
                <ClassListScreen
                  studentId={studentState.studentId}
                  isStudentIdValid={studentState.isValid}
                  onHoldCreated={handleHoldCreated}
                  onSelectHold={handleSelectHold}
                  onNavigateToAdmin={() => handleSwitchPortal('admin')}
                />
              )}

              {studentTab === 'hold-details' && selectedHoldId && (
                <ApplicationDetailsScreen
                  holdId={selectedHoldId}
                  studentId={studentState.studentId}
                  onBack={() => setStudentTab('classes')}
                  onHoldUpdated={() => {}}
                />
              )}

              {studentTab === 'my-holds' && (
                <MyApplicationsScreen
                  studentId={studentState.studentId}
                  isStudentIdValid={studentState.isValid}
                  onSelectHold={handleSelectHold}
                  onHoldsCountChange={setMyHoldsCount}
                />
              )}
            </>
          )}

          {/* ============================================================== */}
          {/* SCHOOL ADMINISTRATION PORTAL (Protected by Auth)               */}
          {/* ============================================================== */}
          {portal === 'admin' && isAdminAuthenticated && (
            <AdminScreen
              adminTab={adminTab}
              onSelectAdminTab={setAdminTab}
              onClassCreated={() => {}}
            />
          )}
        </main>

        {/* Admin Login Modal (Triggered when entering admin without auth) */}
        <AdminLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
