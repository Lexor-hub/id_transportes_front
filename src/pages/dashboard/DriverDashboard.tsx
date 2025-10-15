﻿import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
                const response = await apiService.getVehicles({ status: 'active' });
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
                title: 'Geolocalizaçãoo indisponível',
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

            if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                const deliveriesData = (response.data as unknown as ApiDelivery[])
                    .map((item) => ({
                        id: item.id.toString(),
                        nfNumber: item.nf_number,
                        client: (item.client_name || item.client_name_extracted || 'Cliente Desconhecido').trim(),
                        address: item.delivery_address || 'Endereço Indefinido',
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
                        driverId: item.driver_id !== undefined && item.driver_id !== null ? item.driver_id.toString() : undefined
                    }))
                    .sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return dateA - dateB;
                    });

                // Keep completed deliveries visible until the day rolls over.
                // Consider delivery_date_expected when available (backend may provide it in createdAt or separate field).
                const todayIso = new Date().toISOString().slice(0, 10);
                const filteredDeliveries = deliveriesData.filter((delivery) => {
                    const createdAtIso = delivery.createdAt ? delivery.createdAt.slice(0, 10) : null;
                    // Show delivery if it's from today (by createdAt) or if no date is present show it conservatively
                    return createdAtIso === todayIso || createdAtIso === null;
                });

                setDeliveries(filteredDeliveries as Delivery[]);

            } else {
                setDeliveries([]); 
                if (!response.success) {
                    toast({
                        title: 'Erro ao carregar entregas',
                        description: (response as any).error || 'Nenhuma entrega encontrada para o dia.',
                        variant: 'destructive'
                    });
                }
            }

        } catch (error) {
            setDeliveries([]);
            toast({
                title: 'Erro de Conexão',
                description: 'Não foi possível buscar as entregas. Verifique se o serviço está rodando.',
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
                throw new Error(response.error || 'Não foi possível excluir a entrega.');
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
                                        {/* Seção de Status e Atribuição */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Dados Gerais da Nota</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Status</span> <Badge className="w-fit mt-1">{deliveryDetails.status}</Badge></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Motorista</span> <span>{deliveryDetails.driver_name || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Data Emissão</span> <span>{deliveryDetails.nf_data?.data_emissao ? new Date(deliveryDetails.nf_data.data_emissao).toLocaleDateString('pt-BR') : (deliveryDetails.emission_date ? new Date(deliveryDetails.emission_date).toLocaleDateString('pt-BR') : 'N/A')}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Data Saída</span> <span>{deliveryDetails.nf_data?.data_saida ? new Date(deliveryDetails.nf_data.data_saida).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                                                <div className="flex flex-col sm:col-span-2"><span className="font-medium text-gray-500 text-xs">Chave de Acesso</span> <code className="text-xs break-all">{deliveryDetails.nf_data?.chave_acesso || deliveryDetails.nf_data?.chave || 'N/A'}</code></div>
                                                <div className="flex flex-col sm:col-span-2"><span className="font-medium text-gray-500 text-xs">Protocolo</span> <code className="text-xs">{deliveryDetails.nf_data?.protocolo_autorizacao || 'N/A'}</code></div>
                                            </div>
                                        </div>

                                        {/* Seção do Destinatário */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Destinatário</h3>
                                            <div className="space-y-1">
                                                <p className="font-bold">{deliveryDetails.destinatario?.razao_social || deliveryDetails.clientName}</p>
                                                <p className="text-gray-600">{deliveryDetails.destinatario?.endereco || deliveryDetails.deliveryAddress}</p>
                                                <p className="text-gray-600">{deliveryDetails.destinatario?.municipio} - {deliveryDetails.destinatario?.uf}, CEP: {deliveryDetails.destinatario?.cep}</p>
                                                <p className="text-gray-600">CNPJ: {deliveryDetails.destinatario?.cnpj_cpf || deliveryDetails.clientCnpj}</p>
                                            </div>
                                        </div>

                                        {/* Seção do Remetente */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Remetente</h3>
                                            <div className="space-y-1">
                                                <p className="font-bold">{deliveryDetails.remetente?.razao_social || 'N/A'}</p>
                                                <p className="text-gray-600">CNPJ: {deliveryDetails.remetente?.cnpj_cpf || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {/* Seção de Valores */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Valores</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Total da Nota</span> <span>R$ {Number(deliveryDetails.valores?.valor_total_nota || deliveryDetails.merchandise_value || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Total Produtos</span> <span>R$ {Number(deliveryDetails.valores?.valor_total_produtos || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Frete</span> <span>R$ {Number(deliveryDetails.valores?.valor_frete || 0).toFixed(2)}</span></div>
                                            </div>
                                        </div>

                                        {/* Seção de Impostos */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Impostos</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Base Cálculo ICMS</span> <span>R$ {Number(deliveryDetails.impostos?.base_calculo_icms || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Valor ICMS</span> <span>R$ {Number(deliveryDetails.impostos?.valor_icms || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Valor IPI</span> <span>R$ {Number(deliveryDetails.impostos?.valor_ipi || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Total Tributos</span> <span>R$ {Number(deliveryDetails.impostos?.valor_total_tributos || 0).toFixed(2)}</span></div>
                                            </div>
                                        </div>

                                        {/* Seção de Volumes */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Volumes</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Quantidade</span> <span>{deliveryDetails.volumes?.quantidade || deliveryDetails.delivery_volume || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Espécie</span> <span>{deliveryDetails.volumes?.especie || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Peso Bruto</span> <span>{deliveryDetails.volumes?.peso_bruto || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Peso Líquido</span> <span>{deliveryDetails.volumes?.peso_liquido || 'N/A'}</span></div>
                                            </div>
                                        </div>

                                        {/* Seção de Itens da Nota */}
                                        {deliveryDetails.itens_de_linha && deliveryDetails.itens_de_linha.length > 0 && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Itens da Nota</h3>
                                                <ul className="space-y-2">
                                                    {deliveryDetails.itens_de_linha.map((item: any, index: number) => (
                                                        <li key={index}>
                                                            <div className="flex justify-between">
                                                                <span className="pr-2">{item.quantity || 'N/A'}x {item.description || 'Item sem descrição'}</span>
                                                                <span className="font-medium">R$ {Number(item.total_price || 0).toFixed(2)}</span>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Seção de Faturas (Duplicatas) */}
                                        {deliveryDetails.duplicatas && deliveryDetails.duplicatas.length > 0 && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Faturas</h3>
                                                <ul className="space-y-2">
                                                    {deliveryDetails.duplicatas.map((dup: any, index: number) => (
                                                        <li key={index}>
                                                            <div className="flex justify-between">
                                                                <span>Parcela {dup.installment_number || String(index + 1).padStart(3, '0')}</span>
                                                                <div className="text-right">
                                                                    <span className="font-medium">R$ {Number(dup.amount || 0).toFixed(2)}</span>
                                                                    <span className="ml-2 text-gray-500 text-xs">Venc: {dup.due_date ? new Date(dup.due_date).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Seção de Observações */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Informações Complementares</h3>
                                            <p className="text-gray-600 whitespace-pre-wrap">{deliveryDetails.informacoes_complementares || 'Nenhuma.'}</p>
                                        </div>
                                        
                                        {/* Seção do Canhoto Anexado */}
                                        {deliveryDetails.receipt_image_url && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <a href={deliveryDetails.receipt_image_url} target="_blank" rel="noopener noreferrer">
                                                    <img src={deliveryDetails.receipt_image_url} alt="Prévia do canhoto" className="rounded-md w-full h-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
                                                </a>
                                                <p className="text-xs text-center text-gray-500 mt-2">Clique na imagem para ampliar</p>
                                            </div>
                                        )}

                                        {/* Aqui você pode adicionar mais campos como created_at, etc. */}
                                        
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
                                <SelectContent>
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
