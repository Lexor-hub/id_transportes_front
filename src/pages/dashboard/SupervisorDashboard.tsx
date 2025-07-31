import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  MapPin,
  Search,
  FileText,
  Users
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export const SupervisorDashboard = () => {
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    entregasPendentes: 0,
    motoristasAtivos: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await apiService.getDailyStatus();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Operacional</h1>
            <p className="text-muted-foreground mt-1">
              Monitoramento e controle das operações - {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Button className="bg-gradient-primary">
            <Search className="mr-2 h-4 w-4" />
            Buscar Entregas
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full overflow-x-auto">
          <StatsCard
            title="Total de Entregas"
            value={stats.totalEntregas}
            icon={Package}
            description="Entregas do dia"
            variant="default"
          />
          <StatsCard
            title="Entregas Realizadas"
            value={stats.entregasRealizadas}
            icon={CheckCircle}
            description="Concluídas"
            variant="success"
          />
          <StatsCard
            title="Em Andamento"
            value={stats.entregasPendentes}
            icon={Truck}
            description="Rotas ativas"
            variant="warning"
          />
          <StatsCard
            title="Motoristas Ativos"
            value={stats.motoristasAtivos}
            icon={Users}
            description="Em operação"
            variant="default"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ações de Supervisão
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="justify-start h-12">
                <MapPin className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Rastreamento de Motoristas</div>
                  <div className="text-xs text-muted-foreground">Monitorar localização em tempo real</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-12">
                <Search className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Buscar Canhotos</div>
                  <div className="text-xs text-muted-foreground">Consultar comprovantes de entrega</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-12">
                <FileText className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Relatórios Básicos</div>
                  <div className="text-xs text-muted-foreground">Gerar relatórios operacionais</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-12">
                <Users className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Cadastrar Motorista</div>
                  <div className="text-xs text-muted-foreground">Adicionar novo motorista</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Active Routes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Rotas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center">
                      <Truck className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">João Silva</p>
                      <p className="text-sm text-muted-foreground">Rota 001 - 12/15 entregas</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center">
                      <Truck className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium">Maria Santos</p>
                      <p className="text-sm text-muted-foreground">Rota 002 - 8/10 entregas</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Carlos Oliveira</p>
                      <p className="text-sm text-muted-foreground">Rota 003 - 5/8 entregas</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts and Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas e Notificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">Atraso na Rota 004</p>
                  <p className="text-sm text-muted-foreground">Pedro Costa está 30 min atrasado na programação</p>
                </div>
                <span className="text-xs text-muted-foreground">há 15 min</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-danger/5 border border-danger/20">
                <AlertTriangle className="h-5 w-5 text-danger" />
                <div className="flex-1">
                  <p className="font-medium">Entrega com problema</p>
                  <p className="text-sm text-muted-foreground">NF 98765 - Destinatário ausente</p>
                </div>
                <span className="text-xs text-muted-foreground">há 32 min</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Meta diária atingida</p>
                  <p className="text-sm text-muted-foreground">85% das entregas já foram concluídas</p>
                </div>
                <span className="text-xs text-muted-foreground">há 1h</span>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};