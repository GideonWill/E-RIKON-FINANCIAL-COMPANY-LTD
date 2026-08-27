import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { AccountsPage } from './pages/AccountsPage';
import { TellerPage } from './pages/TellerPage';
import { FieldOfficerPage } from './pages/FieldOfficerPage';
import { LoansPage } from './pages/LoansPage';
import { ReportsPage } from './pages/ReportsPage';
import { EndOfDayPage } from './pages/EndOfDayPage';
import { AuditPage } from './pages/AuditPage';
import { CompanyInterestPage } from './pages/CompanyInterestPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { SplashScreen } from './components/ui/SplashScreen';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SplashScreen minDuration={1800} />
          <BrowserRouter>
            <Routes>
              {/* Login & Registration Portal */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Workstation Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        
                        <Route path="/customers" element={<CustomersPage />} />
                        
                        <Route path="/accounts" element={<AccountsPage />} />
                        
                        <Route
                          path="/company-interest"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'AUDITOR']}>
                              <CompanyInterestPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/approvals"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                              <ApprovalsPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/teller"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'TELLER']}>
                              <TellerPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route
                          path="/field-officer"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'FIELD_OFFICER']}>
                              <FieldOfficerPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route
                          path="/loans"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'LOAN_OFFICER', 'AUDITOR']}>
                              <LoansPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/end-of-day" element={<EndOfDayPage />} />
                        
                        <Route
                          path="/audit"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'AUDITOR']}>
                              <AuditPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
