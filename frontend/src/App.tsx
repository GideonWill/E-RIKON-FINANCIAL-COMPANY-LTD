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
import { BranchesPage } from './pages/BranchesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Workstation Routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        
                        <Route path="/customers" element={<CustomersPage />} />
                        
                        <Route path="/accounts" element={<AccountsPage />} />
                        
                        <Route
                          path="/teller"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_ADMIN', 'TELLER']}>
                              <TellerPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route
                          path="/field-officer"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_ADMIN', 'FIELD_OFFICER']}>
                              <FieldOfficerPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route
                          path="/loans"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_ADMIN', 'LOAN_OFFICER', 'AUDITOR']}>
                              <LoansPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route
                          path="/branches"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_ADMIN', 'AUDITOR']}>
                              <BranchesPage />
                            </ProtectedRoute>
                          }
                        />
                        
                        <Route path="/reports" element={<ReportsPage />} />
                        
                        <Route
                          path="/audit"
                          element={
                            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_ADMIN', 'AUDITOR']}>
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
