import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Truck, 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  MapPin,
  FileText,
  Activity,
  Search,
  RefreshCw,
  Award,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DeliveryUpload } from '@/components/delivery/DeliveryUpload';
import { computeMovementStatus, MovementStatus, getMovementStatusTw, MOVEMENT_STATUS_LABEL } from '@/lib/driver-status';

type DriverStatusItem = {
  id: string;
  name: string;
  speed: number;
  lastUpdate: string | null;
  status: MovementStatus;
  vehicleId: string | null;
  vehicleLabel: string | null;
};

type TodayDelivery = {
  id: string;
  nfNumber: string;
  clientName: string;
  driverName: string;
  address: string;
  statusLabel: string;
  createdAt: string;
  receipt_id?: string | null;
  receipt_image_url?: string | null;
  filename?: string | null;
};

type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'danger';
  timestamp: string;
};

const ALERT_STYLE = {
  danger: {
    container: 'bg-destructive/5 border border-destructive/30',
    iconClass: 'text-destructive',
    icon: AlertTriangle,
  },
  warning: {
    container: 'bg-warning/5 border border-warning/30',
    iconClass: 'text-warning',
    icon: AlertTriangle,
  },
  info: {
    container: 'bg-primary/5 border border-primary/20',
    iconClass: 'text-primary',
    icon: CheckCircle,
  },
} as const;

const formatDateTime = (isoDate?: string) => {
  if (!isoDate) return 'N/A';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatRelativeTime = (timestamp?: string | null) => {
  if (!timestamp) return "Sem atualizacao";
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return "Sem atualizacao";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60000) return "Agora mesmo";
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `Ha ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Ha ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Ha ${diffDays} d`;
};


const resolvePathValue = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== 'object') return null;
  const segments = path.split('.');
  let current: any = source;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment as keyof typeof current];
    } else {
      return null;
    }
  }
  return current;
};

const sanitizeTextValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
};

const sanitizeKey = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

const extractValueByPatterns = (source: unknown, patterns: string[]): string | null => {
  if (!patterns || !patterns.length) return null;
  const normalizedPatterns = patterns.map(sanitizeKey).filter(Boolean);
  if (!normalizedPatterns.length) return null;

  const stack: unknown[] = [source];
  const visited = new WeakSet<object>();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    const currentObj = current as object;
    if (visited.has(currentObj)) continue;
    visited.add(currentObj);

    if (Array.isArray(current)) {
      for (const item of current) {
        if (item && typeof item === 'object') {
          stack.push(item);
        } else {
          const candidate = sanitizeTextValue(item);
          if (candidate) return candidate;
        }
      }
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = sanitizeKey(key);
      if (normalizedPatterns.some((pattern) => normalizedKey.includes(pattern))) {
        const candidate = sanitizeTextValue(value);
        if (candidate) return candidate;
      }
      if (value && typeof value === 'object') {
        stack.push(value);
      } else {
        const candidate = sanitizeTextValue(value);
        if (candidate && normalizedPatterns.some((pattern) => normalizedKey.includes(pattern))) {
          return candidate;
        }
      }
    }
  }

  return null;
};

const pickTextValue = (source: unknown, paths: string[], patterns: string[]): string | null => {
  for (const path of paths) {
    const candidate = sanitizeTextValue(resolvePathValue(source, path));
    if (candidate) return candidate;
  }

  const patternCandidate = extractValueByPatterns(source, patterns);
  if (patternCandidate) return patternCandidate;

  return null;
};

const NF_NUMBER_FIELDS = [
  'nf_number',
  'nfNumber',
  'nf',
  'nfe',
  'nota_fiscal',
  'notaFiscal',
  'invoice_number',
  'delivery.nfNumber',
  'delivery.nf_number',
  'invoice.number',
  'document.number',
  'metadata.nf_number',
  'metadata.document_number',
  'documento.numero',
];

const NF_NUMBER_PATTERNS = [
  'nfnumber',
  'nota',
  'fiscal',
  'documentnumber',
  'numerodocumento',
  'numeronota',
];

const CLIENT_NAME_FIELDS = [
  'client_name',
  'clientName',
  'client_name_extracted',
  'client.name',
  'client.fantasy_name',
  'client.trade_name',
  'customer.name',
  'destinatario.nome',
  'receiver.name',
  'recipient.name',
  'consignee.name',
  'metadata.client_name',
  'metadata.customer_name',
  'cliente.nome',
];

const CLIENT_NAME_PATTERNS = [
  'clientname',
  'customer',
  'destinatario',
  'receiver',
  'recipient',
  'consignee',
  'empresa',
  'cliente',
];

const DRIVER_NAME_FIELDS = [
  'driver_name',
  'driverName',
  'driver_full_name',
  'driver.full_name',
  'driver.name',
  'driver.user.full_name',
  'driver.user.name',
  'driver_details.name',
  'assigned_driver_name',
  'assignedDriver.name',
  'metadata.driver_name',
  'driverInfo.name',
  'driverRecord.name',
  'motorista.nome',
];

const DRIVER_NAME_PATTERNS = [
  'drivername',
  'motorista',
  'condutor',
  'driver',
];

const ADDRESS_FIELDS = [
  'delivery_address',
  'deliveryAddress',
  'client_address',
  'clientAddress',
  'address',
  'client.address',
  'destinatario.endereco',
  'destination.address',
  'location.address',
  'route.destination_address',
  'address.full',
  'delivery.destination',
  'destination.full_address',
  'metadata.address',
  'metadata.delivery_address',
  'delivery.address',
];

const ADDRESS_PATTERNS = [
  'address',
  'endereco',
  'destino',
  'logradouro',
];

const DATE_FIELDS = [
  'created_at',
  'createdAt',
  'delivery_date_actual',
  'deliveryDateActual',
  'delivery_date_expected',
  'deliveryDateExpected',
  'date',
  'timestamp',
  'metadata.created_at',
];

const DATE_PATTERNS = [
  'createdat',
  'data',
  'date',
  'timestamp',
  'deliverydate',
];



const formatDeliveryStatus = (status?: string, hasReceipt?: boolean) => {
  const normalized = (status || '').toUpperCase();
  if (hasReceipt || normalized === 'DELIVERED' || normalized === 'ENTREGUE') {
    return 'Realizada';
  }
  switch (normalized) {
    case 'IN_TRANSIT':
    case 'EM_ANDAMENTO':
      return 'Em andamento';
    case 'PENDING':
    case 'PENDENTE':
      return 'Pendente';
    case 'REATTEMPTED':
      return 'Reentrega';
    case 'PROBLEM':
      return 'Problema';
    case 'REFUSED':
      return 'Recusada';
    case 'CANCELLED':
    case 'CANCELED':
      return 'Cancelada';
    default:
      return status || 'Indefinido';
  }
};

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    entregasPendentes: 0,
    motoristasAtivos: 0, // Mantido
  });
  const [loading, setLoading] = useState(true);
  const [showDeliveryUpload, setShowDeliveryUpload] = useState(false);
  
  // Estados do SupervisorDashboard
  const [driverStatuses, setDriverStatuses] = useState<DriverStatusItem[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [finishedDeliveries, setFinishedDeliveries] = useState<TodayDelivery[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [serverAlerts, setServerAlerts] = useState<AlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10;

  const { toast } = useToast();
  const navigate = useNavigate();

  const idleAlerts = useMemo<AlertItem[]>(() => {
    return driverStatuses
      .filter(driver => driver.status === 'stopped')
      .map(driver => ({
        id: `idle-${driver.id}`,
        title: `${driver.name} parado`,
        description: `Sem movimento ha ${formatRelativeTime(driver.lastUpdate)}`,
        severity: 'warning',
        timestamp: driver.lastUpdate ? new Date(driver.lastUpdate).toISOString() : new Date().toISOString(),
      }));
  }, [driverStatuses]);

  const combinedAlerts = useMemo(() => {
    return [...serverAlerts, ...idleAlerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [serverAlerts, idleAlerts]);

  useEffect(() => {
    loadDashboardData();
    loadDriverStatuses();
    loadSupervisorAlerts();

    const driverStatusInterval = setInterval(() => loadDriverStatuses({ silent: true }), 60000);
    const alertsInterval = setInterval(() => loadSupervisorAlerts({ silent: true }), 30000);

    return () => {
      clearInterval(driverStatusInterval);
      clearInterval(alertsInterval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log('[AdminDashboard] 1. Iniciando busca de dados do dashboard...');
      // CORREÇÃO: Usa o endpoint correto para buscar os KPIs.
      const response = await apiService.getDashboardKPIs();
      console.log('[AdminDashboard] 2. Resposta da API recebida:', response);

      if (response.success && response.data) {
        console.log('[AdminDashboard] 3. Resposta com sucesso. Dados brutos:', response.data);
        const kpis: any = response.data;
        const newStats = {
          totalEntregas: kpis.today_deliveries?.total ?? 0,
          entregasRealizadas: kpis.today_deliveries?.completed ?? 0,
          entregasPendentes: kpis.today_deliveries?.pending ?? 0,
          motoristasAtivos: kpis.active_drivers ?? 0, // Adicionado para consistência
        };
        console.log('[AdminDashboard] 4. Novos stats calculados:', newStats);
        setStats(newStats);
      } else {
        console.warn('[AdminDashboard] A resposta da API não foi bem-sucedida ou não continha dados.', response);
      }
    } catch (error) {
      console.error('[AdminDashboard] 5. Ocorreu um erro na busca de dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard",
        variant: "destructive",
      });
    } finally {
      console.log('[AdminDashboard] 6. Finalizando carregamento.');
      setLoading(false);
    }
  };

  const loadDriverStatuses = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) setDriversLoading(true);
      const response = await apiService.getCurrentLocations();
      if (response.success && Array.isArray(response.data)) {
        const now = Date.now();
        const normalized: DriverStatusItem[] = (response.data as any[])
          .map(raw => {
            const driver = (raw ?? {}) as Record<string, any>;
            if (driver.driver_id == null) return null;
            return {
              id: String(driver.driver_id),
              name: String(driver.driver_name ?? 'Motorista'),
              speed: Number(driver.speed ?? 0),
              lastUpdate: typeof driver.last_update === 'string' ? driver.last_update : null,
              status: computeMovementStatus({ speed: driver.speed, last_update: driver.last_update }, now),
              vehicleId: driver.vehicle_id ? String(driver.vehicle_id) : null,
              vehicleLabel: driver.vehicle_label ?? null,
            };
          })
          .filter((item): item is DriverStatusItem => Boolean(item))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setDriverStatuses(normalized);
      }
    } catch (error) {
      if (!silent) toast({ title: 'Falha ao carregar status dos motoristas.', variant: 'destructive' });
    } finally {
      if (!silent) setDriversLoading(false);
    }
  }, [toast]);

  const loadSupervisorAlerts = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setAlertsLoading(true);
    try {
      const response = await apiService.getSupervisorAlerts();
      if (response.success && Array.isArray(response.data)) {
        const normalized: AlertItem[] = (response.data as any[]).map((item, index) => ({
          id: `${String(item.id ?? `server-${index}`)}-${item.timestamp}`,
          title: 'Entrega excluida pelo motorista',
          description: `NF ${item.nfNumber ?? 'N/A'} • Motorista: ${item.driverName ?? 'N/A'}`,
          severity: 'danger',
          timestamp: item.timestamp || new Date().toISOString(),
        }));
        setServerAlerts(normalized);
      }
    } catch (error) {
      if (!silent) toast({ title: 'Erro ao carregar alertas.', variant: 'destructive' });
    } finally {
      if (!silent) setAlertsLoading(false);
    }
  }, [toast]);

  const loadFinishedDeliveries = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const response = await apiService.getCanhotos();
      if (response.success && Array.isArray(response.data)) {
        const deliveriesData = (response.data as any[]).map(item => {
          const hasReceipt = Boolean(item.receipt_id);
          const statusLabel = formatDeliveryStatus(item.status, hasReceipt);

          return {
            id: String(item.id ?? item.delivery_id ?? ''),
            nfNumber: String(item.nf_number || 'N/A'),
            clientName: String(item.client_name || 'Cliente não identificado'),
            driverName: String(item.driver_name || 'Sem motorista'),
            address: String(item.address || 'Endereço não informado'),
            statusLabel,
            createdAt: String(item.date || item.created_at || ''),
            receipt_image_url: String(item.image_url ?? item.receipt_image_url ?? ''),
          } as TodayDelivery;
        });
        setFinishedDeliveries(deliveriesData);
      } else {
        toast({ title: 'Erro ao carregar canhotos', description: (response as any).error || 'Não foi possível buscar as entregas finalizadas.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro de Rede', description: 'Não foi possível conectar ao servidor para buscar os canhotos.', variant: 'destructive' });
    } finally {
      setReceiptsLoading(false);
    }
  }, [toast]);

  const handleReceiptsModalChange = useCallback((open: boolean) => {
    setShowReceiptsModal(open);
    if (open) {
      loadFinishedDeliveries();
    }
  }, [loadFinishedDeliveries]);

  const downloadCsv = () => {
    // Lógica de download CSV do SupervisorDashboard
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // 1. Layout restaurado: O container principal foi adicionado de volta.
    <div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do sistema de entregas - {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full overflow-x-auto">
        <StatsCard
          title="Total de Entregas"
          value={stats.totalEntregas}
          icon={Package}
          description="Entregas programadas hoje"
          variant="default"
        />
        <StatsCard
          title="Entregas Realizadas"
          value={stats.entregasRealizadas}
          icon={CheckCircle}
          description="Concluídas com sucesso"
          variant="success"
        />
        <StatsCard
          title="Entregas Pendentes"
          value={stats.entregasPendentes}
          icon={Truck}
          description="Em andamento"
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
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start h-10 text-sm sm:h-12 sm:text-base" onClick={() => navigate('/dashboard/usuarios')}>
              <Users className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Gerenciar Usuários</div>
                <div className="text-xs text-muted-foreground">Cadastrar e editar usuários</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-10 text-sm sm:h-12 sm:text-base" onClick={() => navigate('/dashboard/veiculos')}>
              <Truck className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Cadastrar Veículos</div>
                <div className="text-xs text-muted-foreground">Adicionar novos veículos</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-10 text-sm sm:h-12 sm:text-base" 
              onClick={() => setShowDeliveryUpload(true)}
            >
              <Package className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Nova Entrega</div>
                <div className="text-xs text-muted-foreground">Cadastrar nova entrega</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-10 text-sm sm:h-12 sm:text-base" onClick={() => navigate('/dashboard/rastreamento')}>
              <MapPin className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Rastreamento</div>
                <div className="text-xs text-muted-foreground">Ver localização dos motoristas</div>
              </div>
            </Button>
            {/* Botão adicionado para buscar canhotos */}
            <Button 
              variant="outline" 
              className="justify-start h-10 text-sm sm:h-12 sm:text-base" 
              onClick={() => handleReceiptsModalChange(true)}
            >
              <Search className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Buscar Canhotos</div>
                <div className="text-xs text-muted-foreground">Consultar comprovantes de entrega</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Right column: Driver Status (copied from Supervisor) and Alerts */}
        <div className="space-y-6">
          {/* Driver Status (copied logic from SupervisorDashboard) */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Status dos Motoristas
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDriverStatuses()}
                disabled={driversLoading}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${driversLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {driversLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              ) : driverStatuses.length ? (
                <ScrollArea className="max-h-[40vh] pr-2">
                  <div className="space-y-3">
                    {driverStatuses.map((driver) => {
                      const statusStyles = getMovementStatusTw(driver.status);
                      const safeSpeed = Math.max(0, Number(driver.speed ?? 0));
                      const showSpeed = safeSpeed >= 1;
                      const formattedSpeed = showSpeed ? safeSpeed.toFixed(1) : null;
                      return (
                        <div key={driver.id} className={`flex items-center justify-between rounded-lg p-3 ${statusStyles.container}`}>
                          <div>
                            <p className={`text-sm font-semibold ${statusStyles.text}`}>{driver.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(driver.lastUpdate)}{formattedSpeed ? ` - ${formattedSpeed} km/h` : ''}
                            </p>
                            {driver.vehicleLabel && (
                              <p className="text-xs text-muted-foreground">Veiculo: {driver.vehicleLabel}</p>
                            )}
                          </div>
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${statusStyles.badge}`}>
                            {MOVEMENT_STATUS_LABEL[driver.status]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum motorista com rastreamento ativo no momento.</p>
              )}
            </CardContent>
          </Card>

          {/* Alerts and Notifications (adjusted to match Supervisor sizing) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alertas e Notificações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              ) : combinedAlerts.length ? (
                <ScrollArea className="max-h-[40vh] pr-2">
                  <div className="space-y-3">
                    {combinedAlerts.map((alert) => {
                      const style = ALERT_STYLE[alert.severity];
                      const Icon = style.icon;
                      return (
                        <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg ${style.container}`}>
                          <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.iconClass}`} />
                          <div className="flex-1">
                            <p className="font-medium">{alert.title}</p>
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(alert.timestamp)}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">Sem alertas no momento.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium">API de Rastreamento</p>
                <p className="text-sm text-muted-foreground">Operacional</p>
              </div>
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium">Processamento OCR</p>
                <p className="text-sm text-muted-foreground">Operacional</p>
              </div>
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium">Base de Dados</p>
                <p className="text-sm text-muted-foreground">Operacional</p>
              </div>
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Funcionalidade corrigida: Modal de Cadastro de Entrega com seleção de motorista habilitada. */}
      <DeliveryUpload
        open={showDeliveryUpload}
        onOpenChange={setShowDeliveryUpload}
        allowDriverSelection={true} // Força a exibição da lista de motoristas.
        onSuccess={() => {
          loadDashboardData(); // Recarrega os KPIs do dashboard
          toast({
            title: "Entrega Cadastrada!",
            description: "A nova entrega foi criada e atribuída com sucesso.",
          });
          // Fecha o modal após o sucesso
          setShowDeliveryUpload(false);
        }}
      />

      {/* Modal de Canhotos (igual ao do Supervisor) */}
      <Dialog open={showReceiptsModal} onOpenChange={handleReceiptsModalChange}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Entregas Finalizadas e Canhotos</DialogTitle>
            <DialogDescription>Lista de todas as entregas concluídas.</DialogDescription>
          </DialogHeader>
          {receiptsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : finishedDeliveries.length ? (
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                {/* Filtros podem ser adicionados aqui no futuro */}
                <div className="ml-auto">
                  <Button variant="default" size="sm" onClick={downloadCsv}>Baixar CSV</Button>
                </div>
              </div>
              <ScrollArea className="max-h-[60vh]">
                {/* Visualização Mobile (Cartões) */}
                <div className="space-y-3 lg:hidden pr-4">
                  {finishedDeliveries.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE).map((delivery) => (
                    <div key={delivery.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">NF {delivery.nfNumber}</p>
                          <p className="text-xs text-muted-foreground">{delivery.clientName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDateTime(delivery.createdAt)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Motorista: {delivery.driverName}</p>
                      <div className="mt-3">
                        {delivery.receipt_image_url ? (
                          <Button variant="outline" size="sm" className="w-full" onClick={async () => {
                            const blobUrl = await apiService.getSecureFile(delivery.receipt_image_url!);
                            setPreviewUrl(blobUrl || delivery.receipt_image_url!);
                          }}>
                            Ver Canhoto
                          </Button>
                        ) : (
                          <div className="text-center text-xs text-muted-foreground py-2">Sem Canhoto</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Visualização Desktop (Tabela) */}
                <div className="hidden lg:block">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b">
                      <tr className="text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">NF</th>
                        <th className="py-2 pr-4 font-medium">Cliente</th>
                        <th className="py-2 pr-4 font-medium">Motorista</th>
                        <th className="py-2 pr-4 font-medium">Data</th>
                        <th className="py-2 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finishedDeliveries.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE).map((delivery) => (
                        <tr key={delivery.id} className="border-b last:border-none">
                          <td className="py-2 pr-4 font-medium">{delivery.nfNumber}</td>
                          <td className="py-2 pr-4">{delivery.clientName}</td>
                          <td className="py-2 pr-4">{delivery.driverName}</td>
                          <td className="py-2 pr-4">{formatDateTime(delivery.createdAt)}</td>
                          <td className="py-2">
                            {delivery.receipt_image_url ? (
                              <Button variant="outline" size="sm" onClick={async () => {
                                const blobUrl = await apiService.getSecureFile(delivery.receipt_image_url!);
                                setPreviewUrl(blobUrl || delivery.receipt_image_url!);
                              }}>
                                Ver Canhoto
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem Canhoto</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between py-2">
                <div className="text-sm text-muted-foreground">Mostrando {(currentPage-1)*PER_PAGE + 1} - {Math.min(currentPage*PER_PAGE, finishedDeliveries.length)} de {finishedDeliveries.length}</div>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Anterior</Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => (p * PER_PAGE < finishedDeliveries.length ? p + 1 : p))} disabled={currentPage * PER_PAGE >= finishedDeliveries.length}>Próxima</Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma entrega finalizada encontrada.</p>
          )}
        </DialogContent>
      </Dialog>

      {previewUrl && (
        <Dialog open={true} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl"><img src={previewUrl} alt="Canhoto" className="w-full h-auto" /></DialogContent>
        </Dialog>
      )}
    </div>
  );
};
