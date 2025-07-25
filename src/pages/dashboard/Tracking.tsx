import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DriverLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

const Tracking: React.FC = () => {
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      setError(null);
      const response = await apiService.getDriverLocations();
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
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-6">
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
                      <th className="px-4 py-2 text-left">Atualizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => (
                      <tr key={loc.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">{loc.name}</td>
                        <td className="px-4 py-2">{loc.latitude}</td>
                        <td className="px-4 py-2">{loc.longitude}</td>
                        <td className="px-4 py-2">{new Date(loc.updatedAt).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Tracking; 