import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DriverLocation {
  driver_id: string;
  driver_name: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  last_update?: string;
  status: string;
  current_delivery_id?: string;
  current_delivery_client?: string;
}

const Tracking: React.FC = () => {
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      setError(null);
      const response = await apiService.getCurrentLocations();
      if (response.success && response.data) {
        setLocations(response.data as DriverLocation[]);
      } else {
        setError(response.error || 'Erro ao carregar localizações');
      }
      setLoading(false);
    };
    fetchLocations();
  }, []);

  return (
    <>
      <div className="container mx-auto px-4 md:px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">Rastreamento de Motoristas</h1>
        {loading ? (
          <p>Carregando localizações...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Localização dos Motoristas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">Latitude</th>
                      <th className="px-4 py-2 text-left">Longitude</th>
                      <th className="px-4 py-2 text-left">Precisão</th>
                      <th className="px-4 py-2 text-left">Velocidade</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Atualizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations && locations.length > 0 ? (
                      locations.map((loc) => (
                        <tr key={loc.driver_id} className="border-b hover:bg-muted/30">
                          <td className="px-4 py-2">{loc.driver_name}</td>
                          <td className="px-4 py-2">{loc.latitude ? loc.latitude.toFixed(6) : 'N/A'}</td>
                          <td className="px-4 py-2">{loc.longitude ? loc.longitude.toFixed(6) : 'N/A'}</td>
                          <td className="px-4 py-2">{loc.accuracy || 0}m</td>
                          <td className="px-4 py-2">{loc.speed || 0} km/h</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              loc.status === 'active' ? 'bg-green-100 text-green-800' :
                              loc.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {loc.status === 'active' ? 'Ativo' :
                               loc.status === 'busy' ? 'Ocupado' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-2">{loc.last_update ? new Date(loc.last_update).toLocaleString('pt-BR') : 'N/A'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          Nenhum motorista ativo no momento
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default Tracking; 