import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Square, 
  MapPin, 
  Package, 
  Camera, 
  CheckCircle,
  AlertTriangle,
  Clock,
  Route
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Delivery {
  id: string;
  nfNumber: string;
  client: string;
  address: string;
  volume: number;
  value: number;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'REALIZADA' | 'PROBLEMA';
  hasReceipt?: boolean;
}

// Interface para os dados da API
interface ApiDelivery {
  id: number;
  nf_number: string;
  client_name_extracted: string;
  delivery_address: string;
  delivery_volume?: number;
  merchandise_value: string;
  status: string;
  driver_name: string;
  created_at: string;
  client_name?: string;
  client_address?: string;
  has_receipt?: boolean;
  receipt_id?: string;
}

export const DriverDashboard = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [routeStarted, setRouteStarted] = useState(false);
  const [dayStarted, setDayStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadTodayDeliveries();
    }
  }, [user]);

  const loadTodayDeliveries = async () => {
    try {
      console.log('Carregando entregas para o motorista:', user?.id);
      const response = await apiService.getDeliveries({ driver_id: user?.id || '' });
      console.log('Resposta da API:', response);
      
      if (response.success && response.data) {
        console.log('Dados recebidos:', response.data);
        console.log('Tipo dos dados:', typeof response.data);
        console.log('É array?', Array.isArray(response.data));
        
        // Converter dados da API para o formato esperado pelo componente
        const formattedDeliveries: Delivery[] = (response.data as unknown as ApiDelivery[]).map(item => ({
          id: item.id.toString(),
          nfNumber: item.nf_number,
          client: item.client_name_extracted,
          address: item.delivery_address,
          volume: item.delivery_volume ?? 1,
          value: Number(item.merchandise_value),
          status: item.has_receipt ? 'REALIZADA' : 
                  item.status === 'DELIVERED' ? 'REALIZADA' : 
                  item.status === 'IN_TRANSIT' ? 'EM_ANDAMENTO' : 
                  item.status === 'PENDING' ? 'PENDENTE' : 'PROBLEMA',
          hasReceipt: item.has_receipt || false
        }));
        console.log('Entregas formatadas:', formattedDeliveries);
        setDeliveries(formattedDeliveries);
      } else {
        console.error('Erro na resposta da API:', response.error);
        toast({
          title: "Erro ao carregar entregas",
          description: response.error || "Não foi possível carregar suas entregas do dia",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao carregar entregas:', error);
      toast({
        title: "Erro ao carregar entregas",
        description: "Não foi possível carregar suas entregas do dia",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartDay = () => {
    setDayStarted(true);
    toast({
      title: "Dia iniciado!",
      description: "Você pode agora fotografar os canhotos e iniciar sua rota",
    });
  };

  const handleStartRoute = () => {
    setRouteStarted(true);
    toast({
      title: "Rota iniciada!",
      description: "Boa viagem! Lembre-se de fotografar os comprovantes",
    });
  };

  const handleFinishRoute = () => {
    setRouteStarted(false);
    toast({
      title: "Rota finalizada!",
      description: "Parabéns! Sua rota foi concluída com sucesso",
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

  // Função para abrir o seletor de arquivo
  const handlePhotoClick = (deliveryId: string) => {
    fileInputRef.current?.click();
  };

  const handleUploadClick = (deliveryId: string) => {
    setUploadingId(deliveryId);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Função para upload do canhoto
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, deliveryId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verificar se já existe um canhoto para esta entrega
    const existingReceipt = deliveries.find(d => d.id === deliveryId)?.hasReceipt;
    if (existingReceipt) {
      toast({ 
        title: 'Canhoto já existe', 
        description: 'Esta entrega já possui um canhoto registrado.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setUploadingId(deliveryId);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deliveryId', deliveryId);
    formData.append('driverId', user?.id || '');
    try {
      const response = await apiService.uploadReceipt(formData);
      if (response.success) {
        toast({ title: 'Upload realizado com sucesso', description: 'Canhoto enviado com sucesso - Entrega finalizada' });
        // Atualizar o status da entrega localmente para REALIZADA
        setDeliveries(prev => prev.map(d => 
          d.id === deliveryId 
            ? { ...d, status: 'REALIZADA', hasReceipt: true }
            : d
        ));
      } else {
        // Verificar se é erro de duplicata
        if (response.error?.includes('Duplicate entry') || response.error?.includes('delivery_note_id')) {
          setUploadError('Esta entrega já possui um canhoto registrado');
          toast({ 
            title: 'Canhoto já existe', 
            description: 'Esta entrega já possui um canhoto registrado.', 
            variant: 'destructive' 
          });
        } else {
          setUploadError(response.error || 'Erro ao fazer upload do canhoto');
          toast({ title: 'Erro no upload', description: response.error, variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({ title: 'Erro no upload', description: 'Falha ao enviar o canhoto.', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 space-y-6 max-w-md lg:max-w-4xl">
        {/* Status Banner */}
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

        {/* Stats */}
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button 
              variant="outline" 
              className="justify-start h-12"
              disabled={!dayStarted}
            >
              <Camera className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Fotografar Canhoto</div>
                <div className="text-xs text-gray-500">Upload do comprovante</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start h-12"
              disabled={!routeStarted}
            >
              <MapPin className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Minha Localização</div>
                <div className="text-xs text-gray-500">Ver rota atual</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="justify-start h-12"
              onClick={loadTodayDeliveries}
            >
              <Package className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Testar API</div>
                <div className="text-xs text-gray-500">Recarregar entregas</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Deliveries List */}
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
                {deliveries.map((delivery) => (
                  <Card key={delivery.id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">NF {delivery.nfNumber}</p>
                          <p className="text-sm text-gray-500">{delivery.client}</p>
                        </div>
                        <Badge className={getStatusColor(delivery.status)}>
                          {getStatusText(delivery.status)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-500">{delivery.address}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Volume: {delivery.volume} itens</span>
                          <span>Valor: R$ {delivery.value ? delivery.value.toFixed(2) : '0.00'}</span>
                        </div>
                      </div>
                      
                      {delivery.status !== 'REALIZADA' && !delivery.hasReceipt && (
                        <div className="mt-4 flex gap-2 items-center">
                          <Button size="sm" onClick={() => handleUploadClick(delivery.id)} disabled={uploadingId === delivery.id}>
                            {uploadingId === delivery.id ? 'Enviando...' : 'Fotografar Canhoto'}
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileChange(e, delivery.id)}
                          />
                          {uploadError && uploadingId === delivery.id && (
                            <span className="text-red-500 text-xs ml-2">{uploadError}</span>
                          )}
                        </div>
                      )}
                      
                      {delivery.hasReceipt && (
                        <div className="mt-4 flex gap-2 items-center">
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Canhoto enviado - Entrega finalizada</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
  );
};

export default DriverDashboard;