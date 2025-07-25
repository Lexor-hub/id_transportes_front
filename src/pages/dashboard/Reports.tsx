import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Report {
  id: string;
  nfNumber: string;
  client: string;
  date: string;
  status: string;
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      const response = await apiService.getDeliveryReports();
      if (response.success && response.data) {
        setReports(response.data as Report[]);
      } else {
        setError(response.error || 'Erro ao carregar relatórios');
      }
      setLoading(false);
    };
    fetchReports();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">Relatórios</h1>
        {loading ? (
          <p>Carregando relatórios...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Relatórios de Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">NF</th>
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">{report.nfNumber}</td>
                        <td className="px-4 py-2">{report.client}</td>
                        <td className="px-4 py-2">{new Date(report.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">{report.status}</td>
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

export default Reports; 