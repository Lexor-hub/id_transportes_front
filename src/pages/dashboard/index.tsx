import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { DriverDashboard } from './DriverDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { ClientDashboard } from './ClientDashboard';

export const Dashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return null; // This should be handled by route protection
  }

  switch (user.role) {
    case 'ADMINISTRADOR':
      return <AdminDashboard />;
    case 'MOTORISTA':
      return <DriverDashboard />;
    case 'SUPERVISOR':
    case 'OPERADOR':
      return <SupervisorDashboard />;
    case 'CLIENTE':
      return <ClientDashboard />;
    default:
      return <AdminDashboard />; // Fallback
  }
};