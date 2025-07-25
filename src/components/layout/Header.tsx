import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, Truck } from 'lucide-react';

export const Header = () => {
  const { user, logout } = useAuth();

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'MOTORISTA': return 'text-primary';
      case 'ADMINISTRADOR': return 'text-danger';
      case 'SUPERVISOR': 
      case 'OPERADOR': return 'text-warning';
      case 'CLIENTE': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'MOTORISTA': return 'Motorista';
      case 'ADMINISTRADOR': return 'Administrador';
      case 'SUPERVISOR': return 'Supervisor';
      case 'OPERADOR': return 'Operador';
      case 'CLIENTE': return 'Cliente';
      default: return role;
    }
  };

  return (
    <header className="bg-gradient-primary shadow-card border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ID Transporte</h1>
            <p className="text-primary-light text-sm">Sistema de Gestão de Entregas</p>
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-white font-medium">{user?.name}</p>
            <p className={`text-sm ${getRoleColor(user?.role || '')}`}>
              {getRoleDisplay(user?.role || '')}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarFallback className="bg-white/20 text-white font-medium">
                    {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuItem className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="flex items-center gap-2 text-destructive"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};