import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { LoadingPage } from '@/components/ui/loading';

// Pages
import { Login } from '@/pages/Login';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';

// Dashboard Pages
import { AdminDashboard } from '@/pages/dashboard/AdminDashboard';
import { ClientDashboard } from '@/pages/dashboard/ClientDashboard';
import { DriverDashboard } from '@/pages/dashboard/DriverDashboard';
import { SupervisorDashboard } from '@/pages/dashboard/SupervisorDashboard';
import Users from '@/pages/dashboard/Users';
import Vehicles from '@/pages/dashboard/Vehicles';
import Deliveries from '@/pages/dashboard/Deliveries';
import Reports from '@/pages/dashboard/Reports';
import Tracking from '@/pages/dashboard/Tracking';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Index />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/usuarios" element={
                <ProtectedRoute allowedRoles={['ADMINISTRADOR']}>
                  <Users />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/veiculos" element={
                <ProtectedRoute allowedRoles={['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR']}>
                  <Vehicles />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/entregas" element={
                <ProtectedRoute allowedRoles={['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR']}>
                  <Deliveries />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/relatorios" element={
                <ProtectedRoute allowedRoles={['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR', 'CLIENTE']}>
                  <Reports />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/rastreamento" element={
                <ProtectedRoute allowedRoles={['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR', 'MOTORISTA', 'CLIENTE']}>
                  <Tracking />
                </ProtectedRoute>
              } />
              
              {/* Role-specific dashboards */}
              <Route path="/dashboard/admin" element={
                <ProtectedRoute allowedRoles={['ADMINISTRADOR']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/cliente" element={
                <ProtectedRoute allowedRoles={['CLIENTE']}>
                  <ClientDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/motorista" element={
                <ProtectedRoute allowedRoles={['MOTORISTA']}>
                  <DriverDashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/dashboard/supervisor" element={
                <ProtectedRoute allowedRoles={['SUPERVISOR', 'OPERADOR']}>
                  <SupervisorDashboard />
                </ProtectedRoute>
              } />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          
          {/* Global Toaster for notifications */}
          <Toaster />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
