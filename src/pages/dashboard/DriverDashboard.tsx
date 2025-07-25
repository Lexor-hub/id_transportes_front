import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
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
      const response = await apiService.getTodayDeliveries(user?.id || '');
      if (response.success && response.data) {
        setDeliveries(response.data as Delivery[]);
      } else {
        toast({
          title: "Erro ao carregar entregas",
          description: "Não foi possível carregar suas entregas do dia",
          variant: "destructive",
        });
      }
    } catch (error) {
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
      case 'REALIZADA': return 'bg-success text-success-foreground';
      case 'EM_ANDAMENTO': return 'bg-warning text-warning-foreground';
      case 'PROBLEMA': return 'bg-danger text-danger-foreground';
      default: return 'bg-muted text-muted-foreground';
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
    setUploadingId(deliveryId);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deliveryId', deliveryId);
    try {
      const response = await apiService.uploadReceipt(formData);
      if (response.success) {
        toast({ title: 'Upload realizado com sucesso', description: '', variant: 'default' });
        loadTodayDeliveries();
      } else {
        setUploadError(response.error || 'Erro ao fazer upload do canhoto');
        toast({ title: 'Erro no upload', description: response.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro no upload', description: 'Falha ao enviar o canhoto.', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-md lg:max-w-4xl">
        {/* Status Banner */}
        <Card className={`border-2 ${dayStarted ? 'border-success bg-success/5' : 'border-warning bg-warning/5'}`}>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${dayStarted ? 'bg-success' : 'bg-warning'} animate-pulse`} />
                <span className="font-medium">
                  {dayStarted ? 'Dia Iniciado' : 'Aguardando Início do Dia'}
                </span>
              </div>
              
              {!dayStarted ? (
                <Button onClick={handleStartDay} className="bg-gradient-primary w-full" size="lg">
                  <Play className="mr-2 h-5 w-5" />
                  Iniciar Dia
                </Button>
              ) : !routeStarted ? (
                <Button onClick={handleStartRoute} className="bg-gradient-success w-full" size="lg">
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
                <Package className="h-8 w-8 mx-auto text-primary mb-2" />
                <div className="text-2xl font-bold">{deliveries.length}</div>
                <p className="text-sm text-muted-foreground">Total Entregas</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-success mb-2" />
                <div className="text-2xl font-bold">
                  {deliveries.filter(d => d.status === 'REALIZADA').length}
                </div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
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
                <div className="text-xs text-muted-foreground">Upload do comprovante</div>
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
                <div className="text-xs text-muted-foreground">Ver rota atual</div>
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
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma entrega programada para hoje</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deliveries.map((delivery) => (
                  <Card key={delivery.id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">NF {delivery.nfNumber}</p>
                          <p className="text-sm text-muted-foreground">{delivery.client}</p>
                        </div>
                        <Badge className={getStatusColor(delivery.status)}>
                          {getStatusText(delivery.status)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{delivery.address}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Volume: {delivery.volume} itens</span>
                          <span>Valor: R$ {delivery.value.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {delivery.status !== 'REALIZADA' && (
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
                            <span className="text-destructive text-xs ml-2">{uploadError}</span>
                          )}
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
    </div>
  );
};