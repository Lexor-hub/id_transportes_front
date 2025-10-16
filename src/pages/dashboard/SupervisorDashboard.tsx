import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DriverForm } from '@/components/forms/DriverForm';
import { 
  Truck, 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  MapPin,
  Search,
  FileText,
  Users,
  Activity,
  ClipboardList,
  RefreshCw,
  Award,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiService } from '@/services/api';
import { computeMovementStatus, getMovementStatusTw, MOVEMENT_STATUS_LABEL, MovementStatus } from '@/lib/driver-status';
import { useToast } from '@/hooks/use-toast';

// CORREÇÃO: Adicionada interface para veículos
type Vehicle = {
  id: string;
  plate: string;
  model: string;
  brand?: string;
};

type DriverStatusItem = {
  id: string;
  name: string;
  speed: number;
  lastUpdate?: string | null;
  status: MovementStatus;
  vehicleId?: string | null;
  vehicleLabel?: string | null;
};

type TodayDelivery = {
  id: string;
  nfNumber: string;
  clientName: string;
  driverName: string;
  address: string;
  statusLabel: string;
  createdAt: string;
  // optional receipt-related fields
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

type DriverReportVehicle = {
  vehicleId: string | null;
  plate: string | null;
  model: string | null;
  brand: string | null;
  label: string;
};

type DriverReportEntry = {
  driverKey: string;
  driverId: string | null;
  userId: string | null;
  name: string;
  username: string | null;
  deliveriesToday: number;
  deliveriesMonth: number;
  occurrencesToday: number;
  occurrencesMonth: number;
  vehiclesToday: DriverReportVehicle[];
  vehiclesMonth: DriverReportVehicle[];
  isTopToday: boolean;
  rankToday: number;
};

type DriverReportSummary = {
  totalDrivers: number;
  totalDeliveriesToday: number;
  totalDeliveriesMonth: number;
  topDriver: {
    driverKey: string;
    driverId: string | null;
    userId: string | null;
    name: string;
    deliveriesToday: number;
  } | null;
};

type DriverPerformanceReport = {
  generatedAt: string;
  summary: DriverReportSummary;
  drivers: DriverReportEntry[];
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

const DRIVER_REPORT_PAGE_SIZE = 10;
const EMPTY_DRIVER_REPORT_LIST: DriverReportEntry[] = [];

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

const formatDateTime = (isoDate?: string) => {
  if (!isoDate) {
    return 'N/A';
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (timestamp?: string | null) => {
  if (!timestamp) {
    return "Sem atualizacao";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Sem atualizacao";
  }

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60000) {
    return "Agora mesmo";
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `Ha ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Ha ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Ha ${diffDays} d`;
};

export const SupervisorDashboard = () => {
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    entregasPendentes: 0,
    motoristasAtivos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverStatuses, setDriverStatuses] = useState<DriverStatusItem[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [todayDeliveries, setTodayDeliveries] = useState<TodayDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [finishedDeliveries, setFinishedDeliveries] = useState<TodayDelivery[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [serverAlerts, setServerAlerts] = useState<AlertItem[]>([]);
  const [showDriverReportModal, setShowDriverReportModal] = useState(false);
  const [driverReportData, setDriverReportData] = useState<DriverPerformanceReport | null>(null);
  const [driverReportLoading, setDriverReportLoading] = useState(false);
  const [driverReportSearchTerm, setDriverReportSearchTerm] = useState('');
  const [driverReportPage, setDriverReportPage] = useState(1);

  const [alertsLoading, setAlertsLoading] = useState(false);
  // filters and pagination for receipts modal
  const [companies, setCompanies] = useState<Array<any>>([]);
  const [drivers, setDrivers] = useState<Array<any>>([]);
  const [filterCompany, setFilterCompany] = useState<string | undefined>(undefined);
  const [filterDriver, setFilterDriver] = useState<string | undefined>(undefined);
  const [companyQuery, setCompanyQuery] = useState<string>('');
  const [driverQuery, setDriverQuery] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); // CORREÇÃO: Estado para armazenar veículos
  const { toast } = useToast();
  const navigate = useNavigate();

  // CORREÇÃO: Função para carregar a lista de veículos
  const loadVehicles = useCallback(async () => {
    try {
      const response = await apiService.getVehicles();
      if (response.success && Array.isArray(response.data)) {
        const normalizedVehicles = (response.data as any[]).map(v => ({
          id: String(v.id),
          plate: v.plate,
          model: v.model,
          brand: v.brand,
        }));
        setVehicles(normalizedVehicles);
      }
    } catch (error) {
      // Silencioso, pois não é crítico para o dashboard principal
    }
  }, []);

  const idleAlerts = useMemo<AlertItem[]>(() => {
    const alerts: AlertItem[] = [];
    driverStatuses.forEach((driver) => {
      if (driver.status !== 'stopped') return;
      const timestamp = driver.lastUpdate ? new Date(driver.lastUpdate).toISOString() : new Date().toISOString();
      alerts.push({
        id: `idle-${driver.id}`,
        title: `${driver.name} parado`,
        description: `Sem movimento ha ${formatRelativeTime(driver.lastUpdate)}`,
        severity: 'warning',
        timestamp,
      });
    });
    return alerts;
  }, [driverStatuses]);

  const combinedAlerts = useMemo(() => {
    const merged = [...serverAlerts, ...idleAlerts];
    return merged.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [serverAlerts, idleAlerts]);

  const formatDriverReportVehicle = useCallback((vehicle: DriverReportVehicle) => {
    if (!vehicle) return 'Veiculo nao identificado';

    const parts: string[] = [];
    if (vehicle.plate) parts.push(String(vehicle.plate).toUpperCase());
    if (vehicle.model) parts.push(String(vehicle.model));
    if (vehicle.brand) parts.push(String(vehicle.brand));

    if (parts.length > 0) {
      return parts.join(' - ');
    }

    return vehicle.label || 'Veiculo nao identificado';
  }, []);

  const driverReportDrivers = driverReportData?.drivers ?? EMPTY_DRIVER_REPORT_LIST;

  useEffect(() => {
    if (!showDriverReportModal) {
      setDriverReportSearchTerm('');
      setDriverReportPage(1);
    }
  }, [showDriverReportModal]);

  useEffect(() => {
    if (driverReportPage !== 1) {
      setDriverReportPage(1);
    }
  }, [driverReportSearchTerm, driverReportDrivers]);

  const driverReportFilteredDrivers = useMemo(() => {
    if (!driverReportDrivers.length) return [];

    const term = driverReportSearchTerm.trim().toLowerCase();
    if (!term) return driverReportDrivers;

    return driverReportDrivers.filter((driver) => {
      const name = (driver.name ?? '').toLowerCase();
      const username = (driver.username ?? '').toLowerCase();
      return name.includes(term) || username.includes(term);
    });
  }, [driverReportDrivers, driverReportSearchTerm]);

  const driverReportTotalPages = Math.max(
    1,
    Math.ceil(driverReportFilteredDrivers.length / DRIVER_REPORT_PAGE_SIZE)
  );

  useEffect(() => {
    if (driverReportPage > driverReportTotalPages) {
      setDriverReportPage(driverReportTotalPages);
    }
  }, [driverReportPage, driverReportTotalPages]);

  const paginatedDrivers = useMemo(() => {
    if (!driverReportFilteredDrivers.length) return [];
    const start = (driverReportPage - 1) * DRIVER_REPORT_PAGE_SIZE;
    return driverReportFilteredDrivers.slice(start, start + DRIVER_REPORT_PAGE_SIZE);
  }, [driverReportFilteredDrivers, driverReportPage]);

  const driverReportTotalFiltered = driverReportFilteredDrivers.length;
  const driverReportRangeStart = driverReportTotalFiltered
    ? (driverReportPage - 1) * DRIVER_REPORT_PAGE_SIZE + 1
    : 0;
  const driverReportRangeEnd = driverReportTotalFiltered
    ? Math.min(driverReportRangeStart + DRIVER_REPORT_PAGE_SIZE - 1, driverReportTotalFiltered)
    : 0;

  const loadDriverStatuses = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setDriversLoading(true);
      }

      try {
        const response = await apiService.getCurrentLocations();

        if (response.success && Array.isArray(response.data)) {
          // CORREÇÃO: Garante que a lista de veículos esteja disponível
          let currentVehicles = vehicles;
          if (currentVehicles.length === 0) {
            const vehicleResponse = await apiService.getVehicles();
            if (vehicleResponse.success && Array.isArray(vehicleResponse.data)) currentVehicles = vehicleResponse.data;
          }
          const now = Date.now();
          const normalized: DriverStatusItem[] = (response.data as Array<Record<string, unknown>>)
            .map((raw) => {
              const driver = (raw ?? {}) as Record<string, unknown>;
              const id = (driver['driver_id'] ?? driver['id']) as string | number | undefined;

              if (id === undefined || id === null) {
                return null;
              }

              const speedValueRaw = driver['speed'];
              const speedValue = Number(speedValueRaw ?? 0);
              const safeSpeed = Number.isFinite(speedValue) ? speedValue : 0;
              const lastUpdateValue = driver['last_update'];

              const vehicleIdRaw = driver['vehicle_id'] ?? driver['vehicleId'];
              const vehicleLabelRaw = driver['vehicle_label'] ?? driver['vehicleLabel'];
              const vehicleId = vehicleIdRaw != null ? String(vehicleIdRaw) : null;
              const normalizedVehicleLabelRaw =
                vehicleLabelRaw != null ? String(vehicleLabelRaw) : null;
              // CORREÇÃO: Busca o label do veículo se não vier da API
              let vehicleFromList: Vehicle | undefined;

              if (vehicleId) {
                vehicleFromList = currentVehicles.find((v) => String(v.id) === vehicleId);
              }

              if (!vehicleFromList && normalizedVehicleLabelRaw) {
                const normalizedPlate = normalizedVehicleLabelRaw.toLowerCase();
                vehicleFromList = currentVehicles.find(
                  (v) => String(v.plate ?? '').toLowerCase() === normalizedPlate
                );
              }

              const vehiclePlateLabel =
                vehicleFromList?.plate != null
                  ? String(vehicleFromList.plate).toUpperCase()
                  : null;

              const vehicleLabel = vehiclePlateLabel ?? normalizedVehicleLabelRaw;

              return {
                id: String(id),
                name: String(driver['driver_name'] ?? 'Motorista'),
                speed: safeSpeed,
                lastUpdate: typeof lastUpdateValue === 'string' ? lastUpdateValue : null,
                status: computeMovementStatus(
                  {
                    speed: typeof speedValueRaw === 'number' ? speedValueRaw : safeSpeed,
                    last_update: typeof lastUpdateValue === 'string' ? lastUpdateValue : null,
                  },
                  now
                ),
                vehicleId,
                vehicleLabel,
              } as DriverStatusItem | null;
            })
            .filter((item): item is DriverStatusItem => Boolean(item))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

          setDriverStatuses(normalized);
        }
      } catch (error) {
        if (!silent) {
          toast({
            title: 'Falha ao carregar motoristas',
            description: 'Nao foi possivel atualizar o status dos motoristas.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!silent) {
          setDriversLoading(false);
        }
      }
    },
    [toast, vehicles] // CORREÇÃO: Adiciona vehicles como dependência
  );

  const loadSupervisorAlerts = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setAlertsLoading(true);
    }

    try {
      const response = await apiService.getSupervisorAlerts();
      if (response.success && Array.isArray(response.data)) {
        const normalized: AlertItem[] = (response.data as Array<Record<string, unknown>>).map((item, index) => {
          const timestamp = typeof item.timestamp === 'string' ? item.timestamp : (typeof item.occurredAt === 'string' ? item.occurredAt : new Date().toISOString());
          const nfNumber = item.nfNumber ?? item.nf_number ?? null;
          const driverName = item.driverName ?? item.driver_name ?? 'Motorista';
          const descriptionParts: string[] = [];
          if (nfNumber) descriptionParts.push(`NF ${nfNumber}`);
          if (driverName) descriptionParts.push(`Motorista: ${driverName}`);
          const vehicleLabel = item.vehicleLabel ?? item.vehicle_label;
          if (vehicleLabel) descriptionParts.push(`Veiculo: ${vehicleLabel}`);
          const description = descriptionParts.length ? descriptionParts.join(' • ') : 'Entrega removida pelo motorista.';
          const rawId = item.id ?? item.deliveryId ?? item.delivery_id ?? `server-${index}`;

          return {
            id: `${String(rawId)}-${timestamp}`,
            title: 'Entrega excluida pelo motorista',
            description,
            severity: 'danger',
            timestamp,
          } as AlertItem;
        });
        setServerAlerts(normalized);
      }
    } catch (error) {
      if (!silent) {
        toast({
          title: 'Erro ao carregar alertas',
          description: 'Nao foi possivel atualizar os alertas operacionais.',
          variant: 'destructive',
        });
      }
    } finally {
      if (!silent) {
        setAlertsLoading(false);
      }
    }
  }, [toast]);

  const loadTodayDeliveries = useCallback(async () => {
    try {
      setDeliveriesLoading(true);
      const response = await apiService.getDeliveries();

      if (response.success && Array.isArray(response.data)) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const normalizeString = (value: unknown, fallback: string) => {
          if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length ? trimmed : fallback;
          }
          return fallback;
        };
        const toTimestamp = (value: string) => {
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        };

        const deliveriesData = (response.data as Array<Record<string, unknown>>).map((item) => {
          const createdAt = typeof item['created_at'] === 'string' ? item['created_at'] : '';
          const hasReceipt = Boolean(item['has_receipt']);
          const status = typeof item['status'] === 'string' ? item['status'] : '';
          const nfNumber = normalizeString(item['nf_number'], 'N/A');
          const clientNamePrimary = normalizeString(item['client_name'], '');
          const clientName = clientNamePrimary || normalizeString(item['client_name_extracted'], 'Cliente não identificado');
          const addressPrimary = normalizeString(item['delivery_address'], '');
          const address = addressPrimary || normalizeString(item['client_address'], 'Endereço não informado');
          const driverName = normalizeString(item['driver_name'], 'Sem motorista');

          return {
            id: String(item['id'] ?? ''),
            nfNumber,
            clientName,
            driverName,
            address,
            statusLabel: formatDeliveryStatus(status, hasReceipt),
            createdAt,
          } as TodayDelivery;
        });

        // CORREÇÃO: O backend já retorna a lista correta, então o filtro de data no frontend foi removido.
        const sorted = deliveriesData.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

        setTodayDeliveries(sorted);
        setStats(prev => ({
          ...prev,
          totalEntregas: sorted.length,
          entregasRealizadas: sorted.filter(d => d.statusLabel === 'Realizada').length,
          entregasPendentes: sorted.filter(d => d.statusLabel === 'Em andamento').length,
        }));
      } else {
        setTodayDeliveries([]);
        setStats(prev => ({
          ...prev,
          totalEntregas: 0,
          entregasRealizadas: 0,
          entregasPendentes: 0,
        }));
  if (!response.success && (response as any).error) {
          toast({
            title: 'Erro ao carregar entregas',
            description: (response as any).error,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      setTodayDeliveries([]);
      toast({
        title: 'Erro ao carregar entregas',
        description: 'Não foi possível carregar as entregas do dia.',
        variant: 'destructive',
      });
    } finally {
      setDeliveriesLoading(false);
    }
  }, [toast]);

  const handleDeliveriesModalChange = useCallback((open: boolean) => {
    setShowDeliveriesModal(open);
    // Only fetch the deliveries list if we don't already have it from KPIs
    if (open && todayDeliveries.length === 0) {
      void loadTodayDeliveries();
    }
  }, [loadTodayDeliveries, todayDeliveries]);

  const loadFinishedDeliveries = useCallback(async (overrideFilters?: Record<string, string>) => {
    // default wrapper to call with current filters and page
    try {
      setReceiptsLoading(true);
      // Busca entregas finalizadas / canhotos via reports service
      const filters: Record<string, string> = {};
      if (overrideFilters) {
        Object.assign(filters, overrideFilters);
      } else {
        if (filterCompany) filters.company_id = filterCompany;
        if (filterDriver) filters.driver_id = filterDriver;
        if (filterStartDate) filters.start_date = filterStartDate;
        if (filterEndDate) filters.end_date = filterEndDate;
      }

      const response = await apiService.getCanhotos(Object.keys(filters).length ? filters : undefined);

      if (response.success && Array.isArray(response.data)) {
        const normalizeString = (value: unknown, fallback: string) => {
          if (typeof value === 'string') return value.trim() || fallback;
          return fallback;
        };

        const deliveriesData = (response.data as Array<Record<string, unknown>>).map((item) => {
          // Accept multiple possible API shapes: some endpoints return `id`, others `delivery_id`.
          const rawId = item['id'] ?? item['delivery_id'] ?? item['deliveryId'];
          const hasReceipt = Boolean(item['receipt_id'] ?? item['receiptId'] ?? item['dr_id'] ?? item['dr']);

          // NF can be provided under different keys depending on backend version
          const nfRaw = item['nf_number'] ?? item['nfNumber'] ?? item['nf'] ?? null;

          // driver name may come from different properties (driver_name, driverName, driver)
          const driverRaw = item['driver_name'] ?? item['driverName'] ?? item['driver'] ?? item['driver_full_name'] ?? null;

          // image URL may be under different keys and we prefer image_url > gcs_path > file_path
          const imageUrl = item['image_url'] ?? item['imageUrl'] ?? item['gcs_path'] ?? item['gcsPath'] ?? item['file_path'] ?? item['filePath'] ?? null;
          const filenameRaw = item['filename'] ?? item['file_name'] ?? item['fileName'] ?? null;

          return {
            id: String(rawId ?? ''),
            nfNumber: normalizeString(nfRaw, 'N/A'),
            clientName: normalizeString(item['client_name'] ?? item['client_name_extracted'], 'Cliente não identificado'),
            driverName: normalizeString(driverRaw, 'Sem motorista'),
            address: normalizeString(item['delivery_address'] ?? item['client_address'], 'Endereço não informado'),
            statusLabel: formatDeliveryStatus(item['status'] as string, hasReceipt),
            createdAt: typeof item['date'] === 'string' ? item['date'] : (typeof item['created_at'] === 'string' ? item['created_at'] : ''),
            receipt_id: (item['receipt_id'] ?? item['receiptId']) ? String(item['receipt_id'] ?? item['receiptId']) : null,
            receipt_image_url: imageUrl ? String(imageUrl) : null,
            filename: filenameRaw ? String(filenameRaw) : null,
            // include optional ids so we can prioritize filtered items on the client
            driver_id: (item['driver_id'] ?? item['driverId'] ?? item['driver']) ? String(item['driver_id'] ?? item['driverId'] ?? item['driver']) : null,
            company_id: (item['company_id'] ?? item['companyId'] ?? item['company']) ? String(item['company_id'] ?? item['companyId'] ?? item['company']) : null,
          } as TodayDelivery & { receipt_id: string | null; receipt_image_url: string | null; filename: string | null; driver_id?: string | null; company_id?: string | null };
        });

        // If filters were provided, move matching items to the top of the list
        let resultList = deliveriesData;
        const filterDriverId = filters.driver_id;
        const filterCompanyId = filters.company_id;
        if (filterDriverId || filterCompanyId) {
          const matched: typeof deliveriesData = [];
          const others: typeof deliveriesData = [];
          for (const d of deliveriesData) {
            const driverMatch = filterDriverId ? (d as any).driver_id === filterDriverId : true;
            const companyMatch = filterCompanyId ? (d as any).company_id === filterCompanyId : true;
            if (driverMatch && companyMatch) matched.push(d);
            else others.push(d);
          }
          resultList = [...matched, ...others];
        }

        setFinishedDeliveries(resultList);
        setCurrentPage(1);
      } else {
        setFinishedDeliveries([]);
        toast({
          title: 'Erro ao carregar canhotos',
          description: (response as any).error || 'Não foi possível buscar as entregas finalizadas.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setFinishedDeliveries([]);
      toast({
        title: 'Erro de Rede',
        description: 'Não foi possível conectar ao servidor para buscar os canhotos.',
        variant: 'destructive',
      });
    } finally {
      setReceiptsLoading(false);
    }
  }, [filterCompany, filterDriver, filterStartDate, filterEndDate, toast]);

  // load companies and drivers for filters
  const loadCompaniesAndDrivers = useCallback(async () => {
    try {
      const companiesResp = await apiService.getCompanies();
      if (companiesResp.success && Array.isArray(companiesResp.data)) {
        setCompanies(companiesResp.data as Array<any>);
      }
      const driversResp = await apiService.getDrivers({ status: 'active' });
      if (driversResp.success && Array.isArray(driversResp.data)) {
        setDrivers((driversResp.data as Array<any>).map(d => ({
          id: String(d.id ?? d.driver_id ?? d.user_id ?? ''),
          name: String(d.name ?? d.full_name ?? d.driver_name ?? 'Motorista'),
          username: String(d.username ?? d.user_name ?? d.login ?? d.email ?? ''),
        })));
      }
    } catch (err) {}
  }, []);

  const handleReceiptsModalChange = useCallback((open: boolean) => {
    setShowReceiptsModal(open);
    if (open) {
      void loadCompaniesAndDrivers();
      void loadFinishedDeliveries();
    }
  }, [loadFinishedDeliveries]);

  const applyFilters = () => {
    // Map companyQuery/driverQuery (name search) to IDs if possible, then apply
    if (companyQuery && companies.length) {
      const found = companies.find(c => String(c.name ?? '').toLowerCase().includes(companyQuery.toLowerCase()));
      if (found) setFilterCompany(String(found.id));
      else setFilterCompany(undefined);
    } else {
      setFilterCompany(undefined);
    }

    if (driverQuery && drivers.length) {
      const q = driverQuery.toLowerCase();
      // Prefer username match
      let foundD = drivers.find(d => String(d.username ?? '').toLowerCase().includes(q));
      if (!foundD) {
        // Fallback to display name
        foundD = drivers.find(d => String(d.name ?? '').toLowerCase().includes(q));
      }
      if (foundD) setFilterDriver(String(foundD.id));
      else setFilterDriver(undefined);
    } else {
      setFilterDriver(undefined);
    }

    setCurrentPage(1);
    const computedFilters: Record<string, string> = {};
    if (companyQuery && companies.length) {
      const found = companies.find(c => String(c.name ?? '').toLowerCase().includes(companyQuery.toLowerCase()));
      if (found) computedFilters.company_id = String(found.id);
    }
    if (driverQuery && drivers.length) {
      const q = driverQuery.toLowerCase();
      let foundD = drivers.find(d => String(d.username ?? '').toLowerCase().includes(q));
      if (!foundD) foundD = drivers.find(d => String(d.name ?? '').toLowerCase().includes(q));
      if (foundD) computedFilters.driver_id = String(foundD.id);
    }

    // include date range if present
    if (filterStartDate) computedFilters.start_date = filterStartDate;
    if (filterEndDate) computedFilters.end_date = filterEndDate;

    void loadFinishedDeliveries(Object.keys(computedFilters).length ? computedFilters : undefined);
  };

  const clearFilters = () => {
    setFilterCompany(undefined);
    setFilterDriver(undefined);
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setCompanyQuery('');
    setDriverQuery('');
    setCurrentPage(1);
    void loadFinishedDeliveries({});
  };

  const downloadCsv = () => {
    const rows = finishedDeliveries.map(d => ({
      delivery_id: d.id,
      nf_number: d.nfNumber,
      client_name: d.clientName,
      driver_name: d.driverName,
      date: d.createdAt,
      image_url: (d as any).receipt_image_url ?? '',
    }));
    const header = Object.keys(rows[0] ?? {}).join(',') + '\n';
    const body = rows.map(r => Object.values(r).map(v => '"' + String(v ?? '') .replace(/"/g, '""') + '"').join(',')).join('\n');
    const csv = header + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canhotos_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchDriverPerformanceReport = useCallback(async () => {
    setDriverReportLoading(true);
    try {
      const response = await apiService.getDriverPerformanceReport();
      if (response.success) {
        setDriverReportData(response.data as DriverPerformanceReport);
      } else {
        setDriverReportData(null);
        toast({
          title: 'Erro ao carregar relatorio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setDriverReportData(null);
      toast({
        title: 'Erro ao carregar relatorio',
        description: 'Nao foi possivel gerar o relatorio de motoristas.',
        variant: 'destructive',
      });
    } finally {
      setDriverReportLoading(false);
    }
  }, [toast]);

  const handleDriverReportModalChange = useCallback((open: boolean) => {
    setShowDriverReportModal(open);
    if (open) {
      void fetchDriverPerformanceReport();
    }
  }, [fetchDriverPerformanceReport]);

  const downloadDriverReportCsv = () => {
    if (!driverReportData || driverReportData.drivers.length === 0) {
      toast({ title: "Nenhum dado para exportar." });
      return;
    }

    const headers = [
      "Motorista",
      "Entregas (Hoje)",
      "Entregas (Mês)",
      "Ocorrências (Hoje)",
      "Ocorrências (Mês)",
      "Veículos (Hoje)",
    ];

    const csvRows = [headers.join(',')];
    driverReportData.drivers.forEach(d => {
      const row = [
        `"${d.name}"`, d.deliveriesToday, d.deliveriesMonth, d.occurrencesToday, d.occurrencesMonth, `"${d.vehiclesToday.map(v => v.label).join('; ')}"`
      ].join(',');
      csvRows.push(row);
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_desempenho_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadDashboardData();
    loadVehicles(); // CORREÇÃO: Carrega os veículos ao montar o componente
  }, []);

  useEffect(() => {
    loadDriverStatuses();

    const intervalId = setInterval(() => {
      loadDriverStatuses({ silent: true });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [loadDriverStatuses]);

  useEffect(() => {
    loadSupervisorAlerts();
    const alertsInterval = setInterval(() => {
      loadSupervisorAlerts({ silent: true });
    }, 30000);

    return () => clearInterval(alertsInterval);
  }, [loadSupervisorAlerts]);

  const loadDashboardData = async () => {
    try {
      // CORREÇÃO: Usa o endpoint correto para buscar os KPIs.
      const response = await apiService.getDashboardKPIs(); 
      if (response.success && response.data) {
        const kpis: any = response.data;
        // The backend returns a nested `today_deliveries` object with { total, completed, pending, in_progress }
        // Keep fallbacks for older flat keys (total_deliveries, cng_deliveries)
        const totalEntregas = Number(
          kpis?.today_deliveries?.total ?? kpis?.total_deliveries ?? kpis?.totalEntregas ?? 0
        );
        const entregasRealizadas = Number(
          kpis?.today_deliveries?.completed ?? kpis?.completed_deliveries ?? kpis?.entregasRealizadas ?? 0
        );
        const entregasPendentes = Number(
          kpis?.today_deliveries?.in_progress ??
          kpis?.today_deliveries?.pending ??
          kpis?.pending_deliveries ??
          kpis?.entregasPendentes ?? 0
        );
        const motoristasAtivos = Number(kpis?.active_drivers ?? kpis?.motoristasAtivos ?? 0);

        const newStats = {
          totalEntregas,
          entregasRealizadas,
          entregasPendentes,
          motoristasAtivos,
        };
        setStats(newStats);

        // If backend returned a list of today's deliveries, normalize and store it
        const deliveriesList = kpis?.today_deliveries?.list;
        if (Array.isArray(deliveriesList)) {
          const mapped: TodayDelivery[] = deliveriesList.map((item: any) => {
            const createdAt = typeof item.created_at === 'string' ? item.created_at : (item.delivery_date_expected || '');
            const hasReceipt = Boolean(item.receipt_id || item.dr_id || item.receiptId || item.dr);
            return {
              id: String(item.id ?? ''),
              nfNumber: String(item.nf_number ?? item.nfNumber ?? 'N/A'),
              clientName: String(item.client_name ?? item.client_name_extracted ?? 'Cliente não identificado'),
              driverName: String(item.driver_name ?? 'Sem motorista'),
              address: String(item.delivery_address ?? item.client_address ?? 'Endereço não informado'),
              statusLabel: formatDeliveryStatus(item.status, hasReceipt),
              createdAt,
            } as TodayDelivery;
          }).sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });

          setTodayDeliveries(mapped);
          setStats(prev => ({
            ...prev,
            totalEntregas: mapped.length,
            entregasRealizadas: mapped.filter(d => d.statusLabel === 'Realizada').length,
            entregasPendentes: mapped.filter(d => d.statusLabel === 'Em andamento').length,
          }));
        }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Operacional</h1>
            <p className="text-muted-foreground mt-1">
              Monitoramento e controle das operações - {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Button className="bg-gradient-primary" onClick={() => handleDeliveriesModalChange(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Entregas do dia
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
              <Button 
                variant="outline" 
                className="justify-start h-12"
                onClick={() => navigate('/dashboard/rastreamento')}
              >
                <MapPin className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Rastreamento de Motoristas</div>
                  <div className="text-xs text-muted-foreground">Monitorar localização em tempo real</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12"
                onClick={() => handleReceiptsModalChange(true)}
              >
                <Search className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Buscar Canhotos</div>
                  <div className="text-xs text-muted-foreground">Consultar comprovantes de entrega</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-12"
                onClick={() => handleDriverReportModalChange(true)}
              >
                <FileText className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Relatorios Basicos</div>
                  <div className="text-xs text-muted-foreground">Resumo de entregas por motorista</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12"
                onClick={() => setShowDriverForm(true)}
              >
                <Users className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Cadastrar Motorista</div>
                  <div className="text-xs text-muted-foreground">Adicionar novo motorista</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Driver Status */}
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
                <div className="space-y-3">
                  {driverStatuses.map((driver) => {
                    const statusStyles = getMovementStatusTw(driver.status);
                    const safeSpeed = driver.speed < 0 ? 0 : driver.speed;
                    const formattedSpeed = safeSpeed.toFixed(1);
                    return (
                      <div
                        key={driver.id}
                        className={`flex items-center justify-between rounded-lg p-3 ${statusStyles.container}`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${statusStyles.text}`}>{driver.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(driver.lastUpdate)} - {formattedSpeed} km/h
                          </p>
                          {driver.vehicleLabel && (
                            <p className="text-xs text-muted-foreground">Veiculo: {driver.vehicleLabel}</p>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${statusStyles.badge}`}
                        >
                          {MOVEMENT_STATUS_LABEL[driver.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum motorista com rastreamento ativo no momento.
                </p>
              )}
            </CardContent>
          </Card>
        {/* Alerts and Notifications */}
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
              <div className="space-y-3">
                {combinedAlerts.map((alert) => {
                  const style = ALERT_STYLE[alert.severity];
                  const Icon = style.icon;
                  return (
                    <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-lg ${style.container}`}>
                      <Icon className={`h-5 w-5 ${style.iconClass}`} />
                      <div className="flex-1">
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem alertas no momento.</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={showDeliveriesModal} onOpenChange={handleDeliveriesModalChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Entregas do dia</DialogTitle>
            <DialogDescription>Resumo das entregas cadastradas por todos os motoristas hoje.</DialogDescription>
          </DialogHeader>
          {deliveriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : todayDeliveries.length ? (
            <ScrollArea className="max-h-[60vh]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">NF</th>
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 font-medium">Motorista</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Horário</th>
                    <th className="py-2 font-medium">Endereço</th>
                  </tr>
                </thead>
                <tbody>
                  {todayDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{delivery.nfNumber}</td>
                      <td className="py-2 pr-4">{delivery.clientName}</td>
                      <td className="py-2 pr-4">{delivery.driverName}</td>
                      <td className="py-2 pr-4">{delivery.statusLabel}</td>
                      <td className="py-2 pr-4">{formatDateTime(delivery.createdAt)}</td>
                      <td className="py-2">{delivery.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma entrega cadastrada hoje até o momento.</p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleDeliveriesModalChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptsModal} onOpenChange={handleReceiptsModalChange}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Entregas Finalizadas e Canhotos</DialogTitle>
            <DialogDescription>Lista de todas as entregas concluídas.</DialogDescription>
          </DialogHeader>
          {receiptsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : finishedDeliveries.length ? (
            <div>
              {/* Filters row */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    list="companies-list"
                    placeholder="Pesquisar empresa..."
                    value={companyQuery}
                    onChange={e => setCompanyQuery(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                  <datalist id="companies-list">
                    {companies.map(c => (
                      <option key={c.id} value={String(c.name)} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    list="drivers-list"
                    placeholder="Pesquisar motorista (usuário)..."
                    value={driverQuery}
                    onChange={e => setDriverQuery(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                  <datalist id="drivers-list">
                    {drivers.map(d => (
                      // show username if available, otherwise show display name
                      <option key={d.id} value={String(d.username || d.name)} />
                    ))}
                  </datalist>
                </div>
                <input type="date" value={filterStartDate ?? ''} onChange={e => setFilterStartDate(e.target.value || undefined)} className="border rounded px-2 py-1" />
                <input type="date" value={filterEndDate ?? ''} onChange={e => setFilterEndDate(e.target.value || undefined)} className="border rounded px-2 py-1" />
                <Button variant="outline" size="sm" onClick={applyFilters}>Filtrar</Button>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
                <div className="ml-auto">
                  <Button variant="default" size="sm" onClick={downloadCsv}>Baixar CSV</Button>
                </div>
              </div>
              <ScrollArea className="max-h-[60vh]">
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
                  {(() => {
                    const start = (currentPage - 1) * PER_PAGE;
                    const paginated = finishedDeliveries.slice(start, start + PER_PAGE);
                    return paginated.map((delivery) => (
                    <tr key={delivery.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{delivery.nfNumber}</td>
                      <td className="py-2 pr-4">{delivery.clientName}</td>
                      <td className="py-2 pr-4">{delivery.driverName}</td>
                      <td className="py-2 pr-4">{formatDateTime(delivery.createdAt)}</td>
                      <td className="py-2">
                        {delivery.receipt_image_url ? (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={async () => {
                              try {
                                // Try to get a secure blob URL for preview if needed
                                const blobUrl = await apiService.getSecureFile(delivery.receipt_image_url!);
                                setPreviewUrl(blobUrl || delivery.receipt_image_url!);
                              } catch (err) {
                                // Fallback: open the original URL
                                window.open(delivery.receipt_image_url, '_blank', 'noopener');
                              }
                            }}>
                              Ver Canhoto
                            </Button>
                            {/* link "Abrir" removed per request; preview remains available via 'Ver Canhoto' button */}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem Canhoto</span>
                        )}
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </ScrollArea>
            {/* Pagination controls */}
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
          {/* Image preview modal */}
          {previewUrl && (
            <Dialog open={true} onOpenChange={() => setPreviewUrl(null)}>
              <DialogContent className="w-full max-w-[92vw] sm:max-w-3xl p-4 sm:p-6">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg sm:text-xl">Visualizar Canhoto</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Ajuste com gesto de pinça ou rolagem para inspecionar os detalhes.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center">
                  <ScrollArea className="max-h-[70vh] w-full">
                    <img
                      src={previewUrl}
                      alt="Canhoto"
                      className="max-h-[68vh] w-full max-w-full object-contain rounded-md shadow-sm"
                    />
                  </ScrollArea>
                </div>
                <DialogFooter className="sm:flex sm:justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() => setPreviewUrl(null)}
                  >
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDriverReportModal} onOpenChange={handleDriverReportModalChange}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <DialogTitle>Relatorio de Motoristas</DialogTitle>
                <DialogDescription>Resumo diario e mensal por motorista.</DialogDescription>
                {driverReportData?.generatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Atualizado em {formatDateTime(driverReportData.generatedAt)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadDriverReportCsv}
                  disabled={driverReportLoading || !driverReportData || driverReportData.drivers.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchDriverPerformanceReport()}
                  disabled={driverReportLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${driverReportLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          </DialogHeader>
          {driverReportLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : driverReportData ? (
            <div className="space-y-4">
              {/* ... (cabeçalho com stats e destaque do dia) ... */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Motoristas</p>
                  <p className="text-lg font-semibold">{driverReportData.summary.totalDrivers}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Entregas hoje</p>
                  <p className="text-lg font-semibold">{driverReportData.summary.totalDeliveriesToday}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Entregas no mes</p>
                  <p className="text-lg font-semibold">{driverReportData.summary.totalDeliveriesMonth}</p>
                </div>
              </div>
              {driverReportData.summary.topDriver ? (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Award className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold">{driverReportData.summary.topDriver.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Destaque do dia com {driverReportData.summary.topDriver.deliveriesToday} entregas
                    </p>
                  </div>
                </div>
              ) : null}

              {/* CONTROLES RESPONSIVOS: Empilha na vertical em telas pequenas e fica lado a lado em telas grandes */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full lg:max-w-sm">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={driverReportSearchTerm}
                      onChange={(event) => setDriverReportSearchTerm(event.target.value)}
                      placeholder="Pesquisar motorista..."
                      aria-label="Pesquisar motorista"
                      className="pl-9"
                      disabled={driverReportLoading}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground lg:flex-row lg:items-center lg:gap-3">
                  <span>
                    {driverReportTotalFiltered}{' '}
                    {driverReportTotalFiltered === 1 ? 'motorista encontrado' : 'motoristas encontrados'}
                  </span>
                  <span>
                    Pagina {driverReportPage} de {driverReportTotalPages}
                  </span>
                </div>
              </div>

              {paginatedDrivers.length ? (
                <>
                  {/* INÍCIO DA CORREÇÃO: Layout de Cartões para Telas Pequenas */}
                  <div className="space-y-3 lg:hidden">
                    {paginatedDrivers.map((driver) => {
                      const vehiclesTodayLabel = driver.vehiclesToday.length
                        ? driver.vehiclesToday.map(formatDriverReportVehicle).join(', ')
                        : 'Sem registro';
                      
                      return (
                        <div key={driver.driverKey} className="space-y-2 rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{driver.name}</p>
                              {driver.username ? (
                                <p className="text-xs text-muted-foreground">@{driver.username}</p>
                              ) : null}
                            </div>
                            {driver.isTopToday ? <Award className="h-4 w-4 text-amber-500" /> : null}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <p>
                              <span className="font-semibold text-foreground">Entregas (hoje):</span>{' '}
                              {driver.deliveriesToday}
                            </p>
                             <p>
                              <span className="font-semibold text-foreground">Entregas (mês):</span>{' '}
                              {driver.deliveriesMonth}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Ocorrências (hoje):</span>{' '}
                              {driver.occurrencesToday}
                            </p>
                             <p>
                              <span className="font-semibold text-foreground">Ocorrências (mês):</span>{' '}
                              {driver.occurrencesMonth}
                            </p>
                          </div>
                           <div className="text-xs text-muted-foreground pt-1 border-t mt-2">
                              <p>
                                <span className="font-semibold text-foreground">Veículos (hoje):</span>{' '}
                                {vehiclesTodayLabel}
                              </p>
                            </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* FIM DA CORREÇÃO */}

                  {/* Tabela para Telas Grandes */}
                  <ScrollArea className="hidden max-h-[60vh] w-full overflow-x-auto lg:block">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      {/* ... (thead da tabela continua o mesmo) ... */}
                      <thead className="border-b">
                        <tr className="text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Motorista</th>
                          <th className="py-2 pr-4 font-medium">Veiculos (hoje)</th>
                          <th className="py-2 pr-4 font-medium">Entregas hoje</th>
                          <th className="py-2 pr-4 font-medium">Entregas mes</th>
                          <th className="py-2 pr-4 font-medium">Ocorrências hoje</th>
                          <th className="py-2 font-medium">Ocorrências mes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDrivers.map((driver) => (
                          <tr key={driver.driverKey} className="border-b last:border-none">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{driver.name}</span>
                                {driver.isTopToday ? <Award className="h-4 w-4 text-amber-500" /> : null}
                              </div>
                              {driver.username && <p className="text-xs text-muted-foreground">@{driver.username}</p>}
                            </td>
                            <td className="py-2 pr-4">
                              {driver.vehiclesToday.length
                                ? driver.vehiclesToday.map(formatDriverReportVehicle).join(', ')
                                : 'Sem registro'}
                            </td>
                            <td className="py-2 pr-4 font-semibold">{driver.deliveriesToday}</td>
                            <td className="py-2 pr-4">{driver.deliveriesMonth}</td>
                            <td className="py-2 pr-4">{driver.occurrencesToday}</td>
                            <td className="py-2">{driver.occurrencesMonth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                  {/* ... (Controles de paginação continuam os mesmos) ... */}
                   <div className="flex flex-col items-center justify-between gap-3 border-t pt-3 text-sm lg:flex-row">
                    <p className="text-muted-foreground">
                      {driverReportTotalFiltered
                        ? `Mostrando ${driverReportRangeStart}-${driverReportRangeEnd} de ${driverReportTotalFiltered} ${
                            driverReportTotalFiltered === 1 ? 'motorista' : 'motoristas'
                          }`
                        : 'Nenhum motorista encontrado'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDriverReportPage((prev) => Math.max(1, prev - 1))}
                        disabled={driverReportPage <= 1}
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDriverReportPage((prev) => Math.min(driverReportTotalPages, prev + 1))
                        }
                        disabled={driverReportPage >= driverReportTotalPages}
                      >
                        Proxima
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum motorista encontrado.
                </p>
              )}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Nenhum dado encontrado.</p>
          )}
          {/* ... (DialogFooter continua o mesmo) ... */}
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleDriverReportModalChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DriverForm 
        open={showDriverForm}
        onOpenChange={setShowDriverForm}
        onSuccess={() => {
          toast({
            title: "Sucesso",
            description: "Motorista cadastrado com sucesso!",
          });
          // Recarregar dados se necessário
          loadDashboardData();
          if (showDeliveriesModal) {
            void loadTodayDeliveries();
          }
        }}
      />
    </div>
  );
};
