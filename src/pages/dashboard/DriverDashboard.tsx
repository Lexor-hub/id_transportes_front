import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Play,
    Square,
    MapPin,
    Package,
    Camera,
    CheckCircle,
    AlertTriangle,
    Plus,
    Route,
    Upload,
    Trash2,
    Car
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DeliveryUpload } from '@/components/delivery/DeliveryUpload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// CORRIGIDO: A interface agora inclui 'createdAt' e 'driverId'
interface Delivery {
    id: string;
    nfNumber: string;
    client: string;
    address: string;
    volume: number;
    value: number;
    status: 'PENDENTE' | 'EM_ANDAMENTO' | 'REALIZADA' | 'PROBLEMA';
    hasReceipt?: boolean;
    createdAt?: string;
    driverId?: string;
    receiptImageUrl?: string; // Adicionado para guardar a URL da imagem
}

interface ApiDelivery {
    id: number;
    nf_number: string;
    client_name_extracted: string;
    delivery_address: string;
    delivery_volume?: number;
    merchandise_value: string;
    status: string;
    driver_name?: string;
    created_at: string;
    client_name?: string;
    client_address?: string;
    has_receipt?: boolean;
    receipt_id?: string;
    receipt_image_url?: string; // Adicionado para corresponder à API
    image_url?: string; // Adicionado para compatibilidade
    driver_id?: number;
}

interface VehicleOption {
    id: string;
    label: string;
    subtitle?: string;
}

const GPS_ACCURACY_THRESHOLD_METERS = 50;
const GPS_ACCURACY_GRACE_PERIOD_MS = 15000;

export const DriverDashboard = () => {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [routeStarted, setRouteStarted] = useState(false);
    const [dayStarted, setDayStarted] = useState(false);
    const [loading, setLoading] = useState(true);

    const { user } = useAuth();
    const { toast } = useToast();

    const resolveDriverId = useCallback(() => {
        const idValue = user?.driver_id ?? user?.id;
        if (idValue === undefined || idValue === null) {
            return null;
        }
        return idValue.toString();
    }, [user]);

    const [showDeliveryUpload, setShowDeliveryUpload] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [deliveryToDelete, setDeliveryToDelete] = useState<Delivery | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [deliveryDetails, setDeliveryDetails] = useState<any>(null); // Para guardar os dados completos
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Estados para o fluxo de captura de foto
    const [showPhotoConfirmModal, setShowPhotoConfirmModal] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<{ file: File, dataUrl: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados para o modal de visualização do canhoto
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptImage, setReceiptImage] = useState<string | null>(null);
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(false);
    const [vehicleSelectionDraft, setVehicleSelectionDraft] = useState<string | null>(null);
    const [showVehicleSelectionModal, setShowVehicleSelectionModal] = useState(false);
    const [pendingRouteStart, setPendingRouteStart] = useState(false);
    const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);

    const [hasLocationConsent, setHasLocationConsent] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('driver_location_consent') === 'true';
    });
    const [showConsentDialog, setShowConsentDialog] = useState(false);
    const [locationActive, setLocationActive] = useState(false);
    const [requestingLocation, setRequestingLocation] = useState(false);
    const locationWatchId = useRef<number | null>(null);
    const [lastKnownPosition, setLastKnownPosition] = useState<GeolocationPosition | null>(null);
    const trackingStartTimestampRef = useRef<number | null>(null);
    const awaitingAccurateFixRef = useRef(false);
    const accuracyToastShownRef = useRef(false);

    const driverId = resolveDriverId();
    const activeVehicle = useMemo(
        () => vehicles.find((vehicle) => vehicle.id === activeVehicleId) ?? null,
        [vehicles, activeVehicleId]
    );

    const currencyFormatter = useMemo(
        () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
        []
    );

    const formatCurrencyValue = useCallback(
        (value?: string | number | null) => {
            if (value === undefined || value === null) return '';
            if (typeof value === 'number' && Number.isFinite(value)) {
                return currencyFormatter.format(value);
            }
            const direct = Number(value);
            if (Number.isFinite(direct)) {
                return currencyFormatter.format(direct);
            }
            const normalized = String(value).replace(/\./g, '').replace(',', '.');
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? currencyFormatter.format(parsed) : String(value);
        },
        [currencyFormatter]
    );

    const formatDateValue = useCallback((value?: string | null) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return String(value);
        }
        return parsed.toLocaleDateString('pt-BR');
    }, []);

    const summaryFields = useMemo(() => {
        if (!deliveryDetails) return [];
        const nfData = deliveryDetails.nf_data ?? {};
        const valores = deliveryDetails.valores ?? {};
        const summary = deliveryDetails.summary ?? {};

        const fields = [
            {
                label: 'Número da NF',
                value:
                    nfData.numero ??
                    deliveryDetails.nf_number ??
                    deliveryDetails.nfNumber ??
                    summary.nf_number ??
                    summary.nfNumber,
            },
            {
                label: 'Chave da NF',
                value:
                    nfData.chave ??
                    nfData.chave_acesso ??
                    deliveryDetails.nfe_key ??
                    summary.nfe_key,
            },
            {
                label: 'Nome do cliente',
                value:
                    deliveryDetails.destinatario?.razao_social ??
                    deliveryDetails.client_name ??
                    deliveryDetails.clientName ??
                    summary.client_name ??
                    summary.clientName,
            },
            {
                label: 'Data de emissão',
                value: formatDateValue(
                    nfData.data_emissao ??
                    deliveryDetails.emission_date ??
                    summary.emission_date ??
                    summary.issueDate
                ),
            },
            {
                label: 'Data de saída',
                value: formatDateValue(
                    nfData.data_saida ??
                    deliveryDetails.delivery_date_expected ??
                    summary.departure_date ??
                    summary.dueDate
                ),
            },
            {
                label: 'Valor total da entrega',
                value: formatCurrencyValue(
                    valores.valor_total_produtos ??
                    summary.merchandise_value ??
                    deliveryDetails.merchandise_value
                ),
            },
            {
                label: 'Valor total da nota',
                value: formatCurrencyValue(
                    valores.valor_total_nota ??
                    summary.invoice_total_value
                ),
            },
        ];

        return fields.filter(
            (field) => field.value && String(field.value).trim().length > 0
        );
    }, [deliveryDetails, formatCurrencyValue, formatDateValue]);



    useEffect(() => {
        if (!driverId) return;
        const storedVehicle = localStorage.getItem(`driver_vehicle_${driverId}`);
        if (storedVehicle) {
            setActiveVehicleId(storedVehicle);
        }
    }, [driverId]);

    useEffect(() => {
        if (!driverId) {
            setVehicles([]);
            setActiveVehicleId(null);
            return;
        }

        let ignore = false;
        const fetchVehicles = async () => {
            setVehiclesLoading(true);
            try {
                const response = await apiService.getVehicles();
                if (!response.success || !Array.isArray(response.data)) {
                    if (!ignore) {
                        setVehicles([]);
                        if (response.success === false && response.error) {
                            toast({
                                title: 'Falha ao carregar veículos',
                                description: response.error,
                                variant: 'destructive'
                            });
                        }
                    }
                    return;
                }

                const normalized = (response.data as Array<Record<string, unknown>>)
                    .map((raw) => {
                        const idCandidate =
                            raw?.['id'] ??
                            raw?.['vehicle_id'] ??
                            raw?.['vehicleId'];
                        if (idCandidate === undefined || idCandidate === null) {
                            return null;
                        }
                        const id = String(idCandidate);
                        const companyCandidate = raw?.['company_id'] ?? raw?.['companyId'];
                        if (
                            companyCandidate !== undefined &&
                            companyCandidate !== null &&
                            user?.company_id &&
                            String(companyCandidate) !== String(user.company_id)
                        ) {
                            return null;
                        }

                        const statusValue =
                            typeof raw?.['status'] === 'string' ? raw?.['status'] :
                                (typeof raw?.['vehicle_status'] === 'string' ? raw?.['vehicle_status'] : undefined);
                        const isActiveFlag =
                            raw?.['is_active'] !== undefined
                                ? Boolean(raw['is_active'])
                                : (typeof statusValue === 'string' ? statusValue.toLowerCase() !== 'inactive' : true);

                        if (!isActiveFlag) {
                            return null;
                        }

                        const plate = raw?.['plate'] ?? raw?.['placa'] ?? raw?.['license_plate'];
                        const model = raw?.['model'] ?? raw?.['modelo'] ?? raw?.['name'];
                        const brand = raw?.['brand'] ?? raw?.['marca'];
                        const color = raw?.['color'] ?? raw?.['cor'];

                        const labelParts: string[] = [];
                        if (plate) labelParts.push(String(plate).toUpperCase());
                        if (model) labelParts.push(String(model));
                        const label = labelParts.length ? labelParts.join(' - ') : `Veiculo ${id}`;

                        const subtitleParts: string[] = [];
                        if (brand) subtitleParts.push(String(brand));
                        if (color) subtitleParts.push(String(color));
                        const subtitle = subtitleParts.length ? subtitleParts.join(' - ') : undefined;

                        return { id, label, subtitle } as VehicleOption;
                    })
                    .filter((value): value is VehicleOption => Boolean(value));

                if (!ignore) {
                    setVehicles(normalized);
                }
            } catch (error) {
                if (!ignore) {
                    toast({
                        title: 'Erro ao carregar veículos',
                        description: error instanceof Error ? error.message : 'Não foi possível listar os veículos.',
                        variant: 'destructive'
                    });
                }
            } finally {
                if (!ignore) {
                    setVehiclesLoading(false);
                }
            }
        };

        fetchVehicles();
        return () => {
            ignore = true;
        };
    }, [driverId, toast, user?.company_id]);

    const stopLocationTracking = useCallback(() => {
        if (typeof navigator !== 'undefined' && navigator.geolocation && locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
            locationWatchId.current = null;
        }
        setLocationActive(false);
        setRequestingLocation(false);
        setLastKnownPosition(null);
        trackingStartTimestampRef.current = null;
        awaitingAccurateFixRef.current = false;
        accuracyToastShownRef.current = false;
    }, []);

    const sendLocationUpdate = useCallback(async (position?: GeolocationPosition) => {
        const targetPosition = position ?? lastKnownPosition;
        const driverId = resolveDriverId();

        if (!targetPosition || !driverId || !routeStarted) {
            return;
        }

        const { latitude, longitude, accuracy, speed, heading } = targetPosition.coords;
        const numericAccuracy = typeof accuracy === 'number' ? accuracy : null;
        const skipAccuracyFilter = Boolean(position);
        const startedTrackingAt = trackingStartTimestampRef.current;
        const isWithinAccuracyGracePeriod =
            typeof startedTrackingAt === 'number'
                ? (Date.now() - startedTrackingAt) < GPS_ACCURACY_GRACE_PERIOD_MS
                : false;

        const shouldSkipForAccuracy =
            !skipAccuracyFilter &&
            numericAccuracy !== null &&
            numericAccuracy > GPS_ACCURACY_THRESHOLD_METERS &&
            isWithinAccuracyGracePeriod;

        if (shouldSkipForAccuracy) {
            if (!awaitingAccurateFixRef.current) {
                awaitingAccurateFixRef.current = true;
            }

            if (!accuracyToastShownRef.current) {
                accuracyToastShownRef.current = true;
                toast({
                    title: 'Ajustando precisão do GPS',
                    description: `Aguardando um sinal de GPS mais preciso (atual: ±m)`,
                });
            }

            return;
        }

        if (awaitingAccurateFixRef.current) {
            awaitingAccurateFixRef.current = false;
            if (accuracyToastShownRef.current) {
                toast({
                    title: 'GPS calibrado',
                    description: 'Agora temos um sinal mais preciso. Seguiremos monitorando sua rota.',
                });
                accuracyToastShownRef.current = false;
            }
        }

        try {
            await apiService.sendDriverLocation({
                driver_id: driverId,
                latitude,
                longitude,
                accuracy: typeof accuracy === 'number' ? accuracy : undefined,
                speed: typeof speed === 'number' ? speed : undefined,
                heading: typeof heading === 'number' ? heading : undefined,
                vehicle_id: activeVehicleId ?? undefined,
            });
        } catch (error) {}
    }, [lastKnownPosition, routeStarted, resolveDriverId, toast, activeVehicleId]);

    const updateDriverStatus = useCallback(async (status: 'online' | 'offline' | 'idle') => {
        const driverId = resolveDriverId();
        if (!driverId) return;
        try {
            await apiService.updateDriverStatus(driverId, status);
        } catch (error) {
        } 
    }, [user]);

    const startLocationTracking = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast({
                title: 'Geolocalizaçãoo indisponivel',
                description: 'O dispositivo não oferece suporte á localização ou a permissão está bloqueada.',
                variant: 'destructive'
            });
            return false;
        }

        if (locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
        }

        setRequestingLocation(true);
        setLocationActive(false);

        trackingStartTimestampRef.current = Date.now();
        awaitingAccurateFixRef.current = false;
        accuracyToastShownRef.current = false;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setLastKnownPosition(position);
                if (!locationActive) { // Apenas na primeira vez que a localização é obtida
                    setLocationActive(true);
                    setRequestingLocation(false);
                    toast({
                        title: 'localização ativada',
                        description: 'Estamos acompanhando seu trajeto apenas enquanto a rota estiver ativa.'
                    });
                }
            },
            (error) => {
                // Se houver um erro, paramos tudo para evitar comportamento inesperado.
                stopLocationTracking();

                setRequestingLocation(false);
                let description = 'Não foi possível ativar a localização.';
                if (error.code === error.PERMISSION_DENIED) {
                    description = 'Permita o acesso á localização para acompanhar o trajeto da rota.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    description = 'Não foi possível obter sua localização atual. Tente novamente em instantes.';
                } else if (error.code === error.TIMEOUT) {
                    description = 'Tempo excedido ao tentar obter sua localização. Tente novamente.';
                }
                toast({
                    title: 'Erro de localização',
                    description,
                    variant: 'destructive'
                });
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );

        locationWatchId.current = watchId;
        return true;
    }, [stopLocationTracking, toast, sendLocationUpdate]);

    // Novo useEffect para enviar a localização sempre que `lastKnownPosition` mudar.
    useEffect(() => {
        if (routeStarted && lastKnownPosition) {
            sendLocationUpdate(lastKnownPosition);
        }
    }, [lastKnownPosition, routeStarted, sendLocationUpdate]);

    // DriverDashboard.tsx (Adicione este handler)
    const handleViewDetails = useCallback(async (delivery: Delivery) => {
        setDetailsLoading(true);
        setDeliveryDetails(null);
        setShowDetailsModal(true);

        try {
            const response = await apiService.getDelivery(delivery.id);

            if (response.success && response.data) {
                setDeliveryDetails(response.data);
            } else {
                toast({
                    title: 'Erro ao carregar detalhes',
                    description: 'Não foi possível carregar as informações detalhadas da entrega.',
                    variant: 'destructive'
                });
                setShowDetailsModal(false);
            }
        } catch (error) {
            toast({
                title: 'Erro de conexão',
                description: 'Não foi possível se comunicar com o servidor.',
                variant: 'destructive'
            });
            setShowDetailsModal(false);
        } finally {
            setDetailsLoading(false);
        }
    }, [toast]);

    const loadTodayDeliveries = useCallback(async () => {
    setLoading(true);

    const driverIdToFetch = resolveDriverId();
    if (!driverIdToFetch) {
        setLoading(false);
        return;
    }

    try {
        const response = await apiService.getDeliveries({
            driver_id: driverIdToFetch
        });

        if (response.success && Array.isArray(response.data)) {
            const todayIso = new Date().toISOString().slice(0, 10);

            const deliveriesData = (response.data as unknown as ApiDelivery[])
                .map((item) => {
                    // CORREÇÃO: Simplifica o acesso a propriedades que podem não estar na interface.
                    const anyItem = item as any;
                    const rawDriverId = anyItem.driver_id ?? anyItem.driverId ?? anyItem.driver_user_id ?? null;
                    const driverIdForDelivery = rawDriverId !== undefined && rawDriverId !== null ? String(rawDriverId) : undefined;

                    return {
                        id: item.id.toString(),
                        nfNumber: item.nf_number,
                        client: (item.client_name || item.client_name_extracted || 'Cliente Desconhecido').trim(),
                        address: item.delivery_address || 'Endereco Nao Informado',
                        volume: item.delivery_volume ?? 1,
                        value: Number(item.merchandise_value || 0),
                        status: item.has_receipt
                            ? 'REALIZADA'
                            : item.status === 'DELIVERED'
                            ? 'REALIZADA'
                            : item.status === 'IN_TRANSIT'
                            ? 'EM_ANDAMENTO'
                            : item.status === 'PENDING'
                            ? 'PENDENTE'
                            : 'PROBLEMA',
                        hasReceipt: Boolean(item.has_receipt),
                        createdAt: item.created_at,
                        receiptImageUrl: item.receipt_image_url || item.image_url || null,
                        driverId: driverIdForDelivery,
                    } as Delivery;
                })
                .filter((delivery) => {
                    if (!delivery.createdAt || delivery.createdAt.length < 10) {
                        return false;
                    }
                    return delivery.createdAt.slice(0, 10) === todayIso;
                })
                .sort((a, b) => {
                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dateA - dateB;
                });

            setDeliveries(deliveriesData as Delivery[]);
        } else {
            setDeliveries([]);
            if (!response.success && (response as any).error) {
                toast({
                    title: 'Erro ao carregar entregas',
                    description: (response as any).error || 'Nao foi possivel carregar as entregas do dia.',
                    variant: 'destructive'
                });
            }
        }
    } catch (error) {
        setDeliveries([]);
        toast({
            title: 'Erro ao carregar entregas',
            description: 'Nao foi possivel carregar as entregas do dia.',
            variant: 'destructive'
        });
    } finally {
        setLoading(false);
    }
}, [resolveDriverId, toast]);

    useEffect(() => {
        const driverId = resolveDriverId();
        if (driverId) {
            loadTodayDeliveries();
        }
    }, [resolveDriverId, loadTodayDeliveries]);

    useEffect(() => {
        if (!routeStarted) {
            stopLocationTracking();
        }
    }, [routeStarted, stopLocationTracking]);

    useEffect(() => {
        return () => {
            stopLocationTracking();
        };
    }, [stopLocationTracking]);

    const handleStartDay = () => {
        setDayStarted(true);
        toast({
            title: "Dia iniciado!",
            description: "Você pode agora fotografar os canhotos e iniciar sua rota",
        });
    };

    const executeRouteStart = useCallback((vehicleInfoOverride?: VehicleOption | null) => {
        if (routeStarted) return;
        setRouteStarted(true);
        updateDriverStatus('online');

        const vehicleInfo = vehicleInfoOverride ?? activeVehicle;
        const vehicleDescription = vehicleInfo
            ? `Veiculo selecionado: ${vehicleInfo.label}${vehicleInfo.subtitle ? ` • ${vehicleInfo.subtitle}` : ''}`
            : 'Lembre-se de fotografar os comprovantes.';

        toast({
            title: 'Rota iniciada!',
            description: `Boa viagem! ${vehicleDescription}`
        });
        startLocationTracking();
    }, [routeStarted, updateDriverStatus, activeVehicle, toast, startLocationTracking]);

    const handleVehicleSelectionCancel = useCallback((showWarning = true) => {
        setShowVehicleSelectionModal(false);
        if (pendingRouteStart) {
            if (showWarning) {
                toast({
                    title: 'Rota nao iniciada',
                    description: 'Selecione um veiculo antes de comecar a rota.',
                    variant: 'destructive'
                });
            }
            setPendingRouteStart(false);
        }
    }, [pendingRouteStart, toast]);

    const requestVehicleSelection = useCallback((startAfterSelection = false) => {
        if (vehiclesLoading) {
            toast({
                title: 'Carregando veiculos',
                description: 'Aguarde enquanto listamos os veiculos disponiveis.'
            });
            return;
        }

        if (vehicles.length === 0) {
            toast({
                title: 'Nenhum veiculo disponivel',
                description: 'Solicite ao supervisor a associacao de um veiculo antes de iniciar a rota.',
                variant: 'destructive'
            });
            return;
        }

        setVehicleSelectionDraft(activeVehicleId ?? vehicles[0].id);
        setPendingRouteStart(startAfterSelection);
        setShowVehicleSelectionModal(true);
    }, [vehiclesLoading, vehicles, activeVehicleId, toast]);

    const handleVehicleSelectionConfirm = useCallback(() => {
        if (!vehicleSelectionDraft) {
            toast({
                title: 'Selecione um veiculo',
                description: 'Escolha o veiculo que sera utilizado na rota.',
                variant: 'destructive'
            });
            return;
        }

        const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleSelectionDraft) ?? null;
        if (!selectedVehicle) {
            toast({
                title: 'Veiculo invalido',
                description: 'Nao foi possivel localizar o veiculo selecionado.',
                variant: 'destructive'
            });
            return;
        }

        if (driverId) {
            localStorage.setItem(`driver_vehicle_${driverId}`, vehicleSelectionDraft);
        }
        setActiveVehicleId(vehicleSelectionDraft);

        const shouldStart = pendingRouteStart;
        handleVehicleSelectionCancel(false);

        if (shouldStart) {
            executeRouteStart(selectedVehicle);
        } else {
            toast({
                title: 'Veiculo selecionado',
                description: `${selectedVehicle.label}${selectedVehicle.subtitle ? ` • ${selectedVehicle.subtitle}` : ''}`
            });
        }
    }, [vehicleSelectionDraft, vehicles, pendingRouteStart, executeRouteStart, toast, driverId, handleVehicleSelectionCancel]);

const handleStartRoute = () => {
        if (!hasLocationConsent) {
            setShowConsentDialog(true);
            return;
        }
        requestVehicleSelection(true);
    };

    const handleFinishRoute = () => {
        if (!routeStarted) {
            return;
        }
        if (lastKnownPosition) {
            sendLocationUpdate(lastKnownPosition);
        } else {
            sendLocationUpdate();
        }
        setRouteStarted(false);
        stopLocationTracking();
        updateDriverStatus('offline');
        toast({
            title: 'Rota finalizada!',
            description: 'Parabéns! Sua rota foi concluída com sucesso.'
        });
    };

    const handleEnableLocation = () => {
        if (!routeStarted) {
            toast({
                title: 'Rota não iniciada',
                description: 'Inicie a sua rota para compartilhar a localização.',
                variant: 'destructive'
            });
            return;
        }
        if (!hasLocationConsent) {
            setShowConsentDialog(true);
            return;
        }

        const trackingStarted = startLocationTracking();
        if (trackingStarted) {
            updateDriverStatus('online');
        }
    };

const handleDisableLocation = () => {
        if (!locationActive && !requestingLocation) {
            return;
        }
        if (lastKnownPosition) {
            sendLocationUpdate(lastKnownPosition);
        } else {
            sendLocationUpdate();
        }
        stopLocationTracking();
        updateDriverStatus('idle');
        toast({
            title: 'Localização desativada',
            description: 'Você pode reativar a qualquer momento enquanto a rota estiver em andamento.'
        });
    };

    const handleConsentAccept = () => {
        setHasLocationConsent(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('driver_location_consent', 'true');
        }
        setShowConsentDialog(false);
        requestVehicleSelection(true);
    };

    const handleConsentDecline = () => {
        setHasLocationConsent(false);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('driver_location_consent');
        }
        setShowConsentDialog(false);
        toast({
            title: 'Consentimento necessário',
            description: 'Para iniciar a rota é preciso autorizar o uso da localização apenas durante o trajeto.',
            variant: 'destructive'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'REALIZADA': return 'bg-green-500 text-white';
            case 'EM_ANDAMENTO': return 'bg-yellow-500 text-white';
            case 'PROBLEMA': return 'bg-red-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'REALIZADA': return 'Realizada';
            case 'EM_ANDAMENTO': return 'Em Andamento';
            case 'PROBLEMA': return 'Problema';
            default: return 'Pendente';
        }
    };

    const canDeleteDelivery = useCallback((delivery: Delivery) => {
        const normalizedStatus = (delivery.status || '').toUpperCase();
        return !['REALIZADA', 'DELIVERED', 'COMPLETED', 'FINALIZADA'].includes(normalizedStatus);
    }, []);

    // Abre o seletor de arquivo para a câmera
    const handleTakePhotoClick = (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        fileInputRef.current?.click();
    };

    // Chamado quando o motorista tira a foto
    const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCapturedPhoto({ file, dataUrl: e.target?.result as string });
                setShowPhotoConfirmModal(true);
            };
            reader.readAsDataURL(file);
        }
        // Limpa o input para permitir tirar a mesma foto novamente se necessário
        event.target.value = '';
    };

    // Chamado quando o motorista confirma a foto
    const handleConfirmPhoto = async () => {
        if (!capturedPhoto || !selectedDelivery) return;

        const driverId = resolveDriverId();
        if (!driverId) {
            toast({ title: "Erro", description: "Não foi possível identificar o motorista.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        try {
            const response = await apiService.attachReceipt(selectedDelivery.id, driverId, capturedPhoto.file);
            if (response.success) {
                toast({
                    title: "Sucesso!",
                    description: "Comprovante enviado e entrega finalizada.",
                });
                // ATUALIZAÇÃO: Atualiza o estado local para refletir a mudança imediatamente
                setDeliveries(prevDeliveries =>
                    prevDeliveries.map(d =>
                        d.id === selectedDelivery.id
                            ? { ...d, status: 'REALIZADA', hasReceipt: true, receiptImageUrl: response.data?.url || response.data?.publicUrl || null }
                            : d
                    )
                );
                setShowPhotoConfirmModal(false);
                setCapturedPhoto(null);
                // Opcional: pode remover o loadTodayDeliveries() se a atualização local for suficiente
                // loadTodayDeliveries(); 
            } else {
                throw new Error((response as any).message || 'Erro desconhecido');
            }
        } catch (error: any) {
            toast({ 
                title: "Erro ao enviar", 
                description: error.message || "Não foi possível enviar o comprovante. Verifique sua conexão.", 
                variant: "destructive" 
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleUploadButtonClick = (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        setShowDeliveryUpload(true);
    };

    const handleRequestDeleteDelivery = (delivery: Delivery) => {
        setDeliveryToDelete(delivery);
        setShowDeleteModal(true);
    };

    const handleConfirmDeleteDelivery = async () => {
        if (!deliveryToDelete) return;

        try {
            setDeletingDeliveryId(deliveryToDelete.id);
            const response = await apiService.deleteDelivery(deliveryToDelete.id);
            if (!response.success) {
                // CORREÇÃO: Acessa a propriedade 'error' de forma segura, tratando o tipo da resposta.
                const errorMessage = (response as { error?: string }).error || 'Não foi possível excluir a entrega.';
                throw new Error(errorMessage);
            }

            toast({
                title: 'Entrega excluída',
                description: `A entrega NF ${deliveryToDelete.nfNumber} foi removida.`,
            });

            setDeliveries((prev) => prev.filter((d) => d.id !== deliveryToDelete.id));
            await loadTodayDeliveries();
        } catch (error: any) {
            toast({
                title: 'Erro ao excluir entrega',
                description: error?.message || 'Não foi possível excluir a entrega. Tente novamente.',
                variant: 'destructive',
            });
        } finally {
            setDeletingDeliveryId(null);
            setShowDeleteModal(false);
            setDeliveryToDelete(null);
        }
    };

    const handleCancelDeleteDelivery = () => {
        setShowDeleteModal(false);
        setDeliveryToDelete(null);
    };

    const getInitialDataForUpload = () => {
        if (!selectedDelivery) return undefined;
        return {
            summary: {
                nfNumber: selectedDelivery.nfNumber,
                clientName: selectedDelivery.client,
                deliveryAddress: selectedDelivery.address,
                merchandiseValue: selectedDelivery.value.toString(),
                volume: selectedDelivery.volume.toString(),
            },
        };
    };

    // Função para buscar e exibir o canhoto de forma segura
    const handleViewReceipt = async (receiptUrl: string) => {
        if (!receiptUrl) return;

        setReceiptLoading(true);
        setShowReceiptModal(true);
        setReceiptImage(null);

        try {
            const imageUrl = await apiService.getSecureFile(receiptUrl);
            if (imageUrl) {
                setReceiptImage(imageUrl);
            } else {
                throw new Error("Não foi possível carregar a imagem do canhoto.");
            }
        } catch (error: any) {
            toast({
                title: "Erro ao carregar canhoto",
                description: error.message || "Ocorreu um problema ao buscar a imagem.",
                variant: "destructive",
            });
            setShowReceiptModal(false);
        } finally {
            setReceiptLoading(false);
        }
    };

    // Limpa a imagem do blob quando o modal é fechado para liberar memória
    useEffect(() => {
        if (!showReceiptModal && receiptImage && receiptImage.startsWith('blob:')) {
            URL.revokeObjectURL(receiptImage);
        }
    }, [showReceiptModal]);

    return (
        <main className="container mx-auto px-4 py-6 space-y-6 max-w-md lg:max-w-4xl">
            {/* Input de arquivo oculto para a câmera */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handlePhotoCapture}
                style={{ display: 'none' }}
            />
            <Card className={`border-2 ${dayStarted ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${dayStarted ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                            <span className="font-medium">
                                {dayStarted ? 'Dia Iniciado' : 'Aguardando Início do Dia'}
                            </span>
                        </div>

                        {!dayStarted ? (
                            <Button onClick={handleStartDay} className="bg-blue-600 hover:bg-blue-700 w-full" size="lg">
                                <Play className="mr-2 h-5 w-5" />
                                Iniciar Dia
                            </Button>
                        ) : !routeStarted ? (
                            <Button onClick={handleStartRoute} className="bg-green-600 hover:bg-green-700 w-full" size="lg">
                                <Route className="mr-2 h-5 w-5" />
                                Iniciar Rota
                            </Button>
                        ) : (
                            <Button onClick={handleFinishRoute} variant="destructive" className="w-full" size="lg">
                                <Square className="mr-2 h-5 w-5" />
                                Finalizar Rota
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Package className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                            <div className="text-2xl font-bold">{deliveries.length}</div>
                            <p className="text-sm text-gray-500">Total Entregas</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                            <div className="text-2xl font-bold">
                                {deliveries.filter(d => d.status === 'REALIZADA').length}
                            </div>
                            <p className="text-sm text-gray-500">Concluídas</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Acoes Rapidas
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                    <div className="rounded-md border border-dashed p-4 bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="rounded-md bg-white p-2 shadow-sm">
                                <Car className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs uppercase text-muted-foreground tracking-wide">Veiculo selecionado</p>
                                <p className="font-medium">
                                    {activeVehicle
                                        ? activeVehicle.label
                                        : vehiclesLoading
                                            ? 'Carregando veiculos...'
                                            : 'Nenhum veiculo selecionado'}
                                </p>
                                {activeVehicle?.subtitle && (
                                    <p className="text-xs text-muted-foreground">{activeVehicle.subtitle}</p>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => requestVehicleSelection(false)}
                            disabled={vehiclesLoading}
                        >
                            {activeVehicle ? 'Trocar veiculo' : 'Selecionar veiculo'}
                        </Button>
                    </div>

                    <Button
                        variant="outline"
                        className="justify-start h-12"
                        onClick={() => { setSelectedDelivery(null); setShowDeliveryUpload(true); }}
                    >
                        <Upload className="mr-3 h-4 w-4" />
                        <div className="text-left">
                            <div className="font-medium">Cadastrar Entrega Manual</div>
                            <div className="text-xs text-gray-500">Usar documento SEFAZ</div>
                        </div>
                    </Button>
                    
                    {routeStarted && (
                        <div className="pl-12 mt-2 text-xs text-gray-500">
                            {requestingLocation
                                ? 'Aguardando confirmacao da localizacao...'
                                : locationActive
                                    ? lastKnownPosition
                                        ? `Ultima atualizacao as ${new Date(lastKnownPosition.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (lat ${lastKnownPosition.coords.latitude.toFixed(5)}, lon ${lastKnownPosition.coords.longitude.toFixed(5)})`
                                        : 'Localizacao ativa. Aguardando primeira atualizacao...'
                                    : 'Localizacao desligada no momento.'}
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Minhas Entregas - Hoje</CardTitle>
                </CardHeader>
                <CardContent>
                    {deliveries.length === 0 ? (
                        <div className="text-center py-8">
                            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-500">Nenhuma entrega programada para hoje</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
        
                        {deliveries.map((delivery) => {
                            const allowDeletion = canDeleteDelivery(delivery) && !delivery.hasReceipt;
                            const isDeletingCurrent = deletingDeliveryId === delivery.id;

                            return (
                            <Card key={delivery.id} className="border">
                                <CardContent className="pt-4">
                                    
                                    {/* Bloco de NF, Nome e Status */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-medium">NF {delivery.nfNumber}</p>
                                            <p className="text-sm text-gray-500">{delivery.client}</p>
                                        </div>
                                        <Badge className={getStatusColor(delivery.status)}>
                                            {getStatusText(delivery.status)}
                                        </Badge>
                                    </div>

                                    {/* Bloco de ENDEREÇO */}
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-500">{delivery.address}</span>
                                        </div>
                                        
                                        {/* VALOR E VOLUME REMOVIDOS DE PROPÓSITO */}
                                        
                                    </div>

                                    {/* Bloco de AÇÕES (Botões) */}
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleViewDetails(delivery)}
                                        >
                                            Ver Detalhes
                                        </Button>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {delivery.status !== 'REALIZADA' && !delivery.hasReceipt && (
                                                <Button size="sm" onClick={() => handleTakePhotoClick(delivery)}>
                                                    <Camera className="mr-2 h-4 w-4" />
                                                    Fotografar Canhoto
                                                </Button>
                                            )}
                                            {delivery.hasReceipt && delivery.receiptImageUrl && (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <button
                                                        onClick={() => handleViewReceipt(delivery.receiptImageUrl!)}
                                                        className="text-sm font-medium text-blue-600 hover:underline disabled:text-gray-400"
                                                        disabled={receiptLoading}
                                                    >
                                                        Ver Canhoto
                                                    </button>
                                                </div>
                                            )}
                                            {delivery.hasReceipt && !delivery.receiptImageUrl && (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span className="text-sm">Entrega Finalizada</span>
                                                </div>
                                            )}
                                            {allowDeletion && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleRequestDeleteDelivery(delivery)}
                                                    disabled={isDeletingCurrent}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    {isDeletingCurrent ? 'Removendo...' : 'Excluir'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                        })}
                        
                        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
                            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{deliveryDetails ? `Detalhes NF ${deliveryDetails.nfNumber}` : 'Carregando Detalhes...'}</DialogTitle>
                                    <DialogDescription>
                                        {deliveryDetails ? 'Informações completas da entrega.' : 'Aguarde o carregamento.'}
                                    </DialogDescription>
                                </DialogHeader>
                                
                                {detailsLoading && (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500">Carregando dados...</p>
                                    </div>
                                )}

                                {deliveryDetails && (
                                    <div className="space-y-4 text-sm">
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Dados informados</h3>
                                            {summaryFields.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">Nenhuma informacao disponivel para esta entrega.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {summaryFields.map((field) => (
                                                        <div key={field.label} className="flex flex-col">
                                                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</span>
                                                            <span className="text-sm text-gray-900">{field.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Fechar</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        </div>
                    )}
                </CardContent>
            </Card>

            <DeliveryUpload
                open={showDeliveryUpload}
                onOpenChange={setShowDeliveryUpload}
                onSuccess={() => {
                    loadTodayDeliveries();
                    toast({
                        title: "Entrega cadastrada",
                        description: "A entrega foi cadastrada com sucesso!",
                    });
                }}
                initialData={getInitialDataForUpload()}
            />

            <Dialog open={showVehicleSelectionModal} onOpenChange={(open) => {
                if (!open) {
                    if (pendingRouteStart) {
                        handleVehicleSelectionCancel();
                    } else {
                        setShowVehicleSelectionModal(false);
                    }
                } else {
                    setShowVehicleSelectionModal(true);
                }
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Selecione o veiculo</DialogTitle>
                        <DialogDescription>Escolha o veiculo que sera utilizado nesta rota.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {vehiclesLoading ? (
                            <div className="text-sm text-muted-foreground">Carregando veiculos disponiveis...</div>
                        ) : vehicles.length === 0 ? (
                            <div className="text-sm text-destructive">Nenhum veiculo disponivel. Procure o supervisor.</div>
                        ) : (
                            <Select value={vehicleSelectionDraft ?? ''} onValueChange={(value) => setVehicleSelectionDraft(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um veiculo" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {vehicles.map((vehicle) => (
                                        <SelectItem key={vehicle.id} value={vehicle.id}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{vehicle.label}</span>
                                                {vehicle.subtitle && (
                                                    <span className="text-xs text-muted-foreground">{vehicle.subtitle}</span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => handleVehicleSelectionCancel()} type="button">Cancelar</Button>
                        <Button onClick={handleVehicleSelectionConfirm} disabled={vehiclesLoading || vehicles.length === 0} type="button">Confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showDeleteModal} onOpenChange={(open) => { if (!open) handleCancelDeleteDelivery(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Excluir entrega</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover a entrega NF {deliveryToDelete?.nfNumber}?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <p className="text-sm text-muted-foreground">
                            A entrega será removida da sua lista. Essa ação não pode ser desfeita.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleCancelDeleteDelivery} disabled={deletingDeliveryId !== null}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDeleteDelivery} disabled={deletingDeliveryId !== null}>
                            {deletingDeliveryId !== null ? 'Removendo...' : 'Excluir Entrega'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal para Visualizar o Canhoto */}
            <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Canhoto da Entrega</DialogTitle>
                        <DialogDescription>Visualização do comprovante anexado.</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center items-center min-h-[300px]">
                        {receiptLoading && <p>Carregando imagem...</p>}
                        {receiptImage && (
                            <a href={receiptImage} target="_blank" rel="noopener noreferrer">
                                <img src={receiptImage} alt="Canhoto da entrega" className="max-w-full max-h-[70vh] object-contain rounded-md" />
                            </a>
                        )}
                        {!receiptLoading && !receiptImage && <p className="text-red-500">Não foi possível carregar a imagem.</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowReceiptModal(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Compartilhamento de localização</DialogTitle>
                        <DialogDescription>
                            Precisamos da sua autorização para coletar a localização apenas enquanto a rota estiver ativa, em conformidade com a LGPD.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm text-muted-foreground">
                                    <p>Com a localização ativa podemos acompanhar o trajeto e oferecer suporte caso surja algum imprevisto.</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>A localização é utilizada somente com a rota iniciada.</li>
                            <li>Você pode desativar o compartilhamento a qualquer momento.</li>
                            <li>Os dados são tratados conforme a Lei Geral de Proteção de Dados (LGPD).</li>
                        </ul>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleConsentDecline}>Não concordo</Button>
                        <Button onClick={handleConsentAccept}>Concordo e iniciar rota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmação da Foto */}
            <Dialog open={showPhotoConfirmModal} onOpenChange={setShowPhotoConfirmModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Foto do Canhoto</DialogTitle>
                        <DialogDescription>
                            Esta foto será anexada à entrega NF {selectedDelivery?.nfNumber}. Deseja continuar?
                        </DialogDescription>
                    </DialogHeader>
                    {capturedPhoto && (
                        <img src={capturedPhoto.dataUrl} alt="Prévia do canhoto" className="rounded-md max-h-80 w-full object-contain" />
                    )}
                    <DialogFooter className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => { setShowPhotoConfirmModal(false); setCapturedPhoto(null); }} disabled={isUploading}>
                            Tirar Outra
                        </Button>
                        <Button onClick={handleConfirmPhoto} disabled={isUploading}>
                            {isUploading ? 'Enviando...' : 'Confirmar e Finalizar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </main>
    );
};
