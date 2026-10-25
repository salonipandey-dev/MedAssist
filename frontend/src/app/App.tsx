import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { PublicLayout } from '../components/layout/PublicLayout';
import { Button, EmptyState, Skeleton } from '../components/ui';
import type { Role } from '../types';
import { Provider } from './Provider';
const Home = lazy(() => import('../pages/public/Pages').then((m) => ({ default: m.Home })));
const PlatformPage = lazy(() =>
  import('../pages/public/Pages').then((m) => ({ default: m.PlatformPage })),
);
const HowItWorks = lazy(() =>
  import('../pages/public/Pages').then((m) => ({ default: m.HowItWorks })),
);
const SecurityPage = lazy(() =>
  import('../pages/public/Pages').then((m) => ({ default: m.SecurityPage })),
);
const AboutPage = lazy(() =>
  import('../pages/public/Pages').then((m) => ({ default: m.AboutPage })),
);
const DemoAccess = lazy(() =>
  import('../features/auth/DemoAccess').then((m) => ({ default: m.DemoAccess })),
);
const PatientOverview = lazy(() =>
  import('../features/patient/Patient').then((m) => ({ default: m.PatientOverview })),
);
const PatientHistory = lazy(() =>
  import('../features/patient/Patient').then((m) => ({ default: m.PatientHistory })),
);
const ActivityView = lazy(() =>
  import('../features/patient/Patient').then((m) => ({ default: m.ActivityView })),
);
const Profile = lazy(() =>
  import('../features/patient/Profile').then((m) => ({ default: m.Profile })),
);
const CaseList = lazy(() =>
  import('../features/cases/Cases').then((m) => ({ default: m.CaseList })),
);
const CaseDetailPage = lazy(() =>
  import('../features/cases/Cases').then((m) => ({ default: m.CaseDetailPage })),
);
const Appointments = lazy(() =>
  import('../features/appointments/Appointments').then((m) => ({ default: m.Appointments })),
);
const Reports = lazy(() =>
  import('../features/reports/Reports').then((m) => ({ default: m.Reports })),
);
const Assessment = lazy(() =>
  import('../features/assessments/Assessment').then((m) => ({ default: m.Assessment })),
);
const DoctorOverview = lazy(() =>
  import('../features/doctor/Doctor').then((m) => ({ default: m.DoctorOverview })),
);
const ReviewWorkspace = lazy(() =>
  import('../features/doctor/Doctor').then((m) => ({ default: m.ReviewWorkspace })),
);
const PatientRecords = lazy(() =>
  import('../features/doctor/Doctor').then((m) => ({ default: m.PatientRecords })),
);
const DoctorSchedule = lazy(() =>
  import('../features/doctor/Doctor').then((m) => ({ default: m.DoctorSchedule })),
);
const AdminOverview = lazy(() =>
  import('../features/admin/Admin').then((m) => ({ default: m.AdminOverview })),
);
const UserManagement = lazy(() =>
  import('../features/admin/Admin').then((m) => ({ default: m.UserManagement })),
);
const AuditActivity = lazy(() =>
  import('../features/admin/Admin').then((m) => ({ default: m.AuditActivity })),
);
const Settings = lazy(() =>
  import('../features/auth/Settings').then((m) => ({ default: m.Settings })),
);
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="container section">
        <EmptyState
          title="The workspace could not load"
          description="Reload to restore the fictional demo. No records have been sent."
          action={<Button onClick={() => window.location.reload()}>Reload demo</Button>}
        />
      </main>
    ) : (
      this.props.children
    );
  }
}
function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    const name = pathname.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') ?? 'Home';
    document.title = `MedAssist · ${name[0].toUpperCase() + name.slice(1)}`;
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
    >{`MedAssist ${pathname.split('/').filter(Boolean).join(' · ') || 'home'} page`}</span>
  );
}
function NotFound({ role }: { role?: Role }) {
  return (
    <EmptyState
      title="This page isn’t here"
      description="Head back to your workspace to continue exploring the fictional demo."
      action={
        <Button asChild>
          <Link to={role ? `/app/${role}` : '/'}>Back to {role ? 'overview' : 'home'}</Link>
        </Button>
      }
    />
  );
}
export function App() {
  return (
    <ErrorBoundary>
      <Provider>
        <BrowserRouter>
          <RouteEffects />
          <Suspense fallback={<Skeleton />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="platform" element={<PlatformPage />} />
                <Route path="how-it-works" element={<HowItWorks />} />
                <Route path="patients" element={<PlatformPage kind="patients" />} />
                <Route path="professionals" element={<PlatformPage kind="professionals" />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="demo" element={<DemoAccess />} />
                <Route path="sign-in" element={<Navigate to="/demo" replace />} />
              </Route>
              <Route path="/app" element={<Navigate to="/demo" replace />} />
              <Route path="/app/patient" element={<AppLayout />}>
                <Route index element={<PatientOverview />} />
                <Route path="profile" element={<Profile />} />
                <Route path="history" element={<PatientHistory />} />
                <Route path="notifications" element={<ActivityView role="patient" />} />
                <Route path="assessments" element={<Assessment />} />
                <Route path="cases" element={<CaseList role="patient" />} />
                <Route path="cases/:caseId" element={<CaseDetailPage role="patient" />} />
                <Route path="appointments" element={<Appointments role="patient" />} />
                <Route path="reports" element={<Reports role="patient" />} />
                <Route path="settings" element={<Settings role="patient" />} />
                <Route path="*" element={<NotFound role="patient" />} />
              </Route>
              <Route path="/app/doctor" element={<AppLayout />}>
                <Route index element={<DoctorOverview />} />
                <Route path="cases" element={<CaseList role="doctor" />} />
                <Route path="cases/:caseId" element={<CaseDetailPage role="doctor" />} />
                <Route path="patients" element={<PatientRecords />} />
                <Route path="reviews" element={<ReviewWorkspace />} />
                <Route path="reviews/:caseId" element={<ReviewWorkspace />} />
                <Route path="appointments" element={<Appointments role="doctor" />} />
                <Route path="schedule" element={<DoctorSchedule />} />
                <Route path="activity" element={<ActivityView role="doctor" />} />
                <Route path="settings" element={<Settings role="doctor" />} />
                <Route path="*" element={<NotFound role="doctor" />} />
              </Route>
              <Route path="/app/admin" element={<AppLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="doctors" element={<UserManagement doctorsOnly />} />
                <Route path="cases" element={<CaseList role="admin" />} />
                <Route path="cases/:caseId" element={<CaseDetailPage role="admin" />} />
                <Route path="appointments" element={<Appointments role="admin" />} />
                <Route path="reports" element={<Reports role="admin" />} />
                <Route path="analytics" element={<AdminOverview detailed />} />
                <Route path="audit" element={<AuditActivity />} />
                <Route path="settings" element={<Settings role="admin" />} />
                <Route path="*" element={<NotFound role="admin" />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  );
}
