import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Receipt {
  id: string;
  deliveryId: string;
  client: string;
  nfNumber: string;
  date: string;
  status: string;
  imageUrl: string;
  ocrStatus: string;
}

const Deliveries: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    setError(null);
    const response = await apiService.getReceipts();
    if (response.success && response.data) {
      setReceipts(response.data as Receipt[]);
    } else {
      setError(response.error || 'Erro ao carregar canhotos');
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Filtro simples no frontend (pode ser trocado por filtro na API)
    fetchReceipts();
  };

  const handleProcessOCR = async (id: string) => {
    setProcessingId(id);
    const response = await apiService.processReceiptOCR(id);
    if (response.success) {
      fetchReceipts();
    } else {
      alert(response.error || 'Erro ao processar OCR');
    }
    setProcessingId(null);
  };

  const filteredReceipts = receipts.filter(r =>
    r.nfNumber.includes(search) ||
    r.client.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Canhotos de Entregas</h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Buscar por NF ou Cliente"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
            />
            <Button type="submit">Buscar</Button>
          </form>
        </div>
        {loading ? (
          <p>Carregando canhotos...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Lista de Canhotos</CardTitle>
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
                      <th className="px-4 py-2 text-left">Comprovante</th>
                      <th className="px-4 py-2 text-left">OCR</th>
                      <th className="px-4 py-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">{r.nfNumber}</td>
                        <td className="px-4 py-2">{r.client}</td>
                        <td className="px-4 py-2">{new Date(r.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">{r.status}</td>
                        <td className="px-4 py-2">
                          {r.imageUrl ? (
                            <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary">Ver</a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2">{r.ocrStatus || '-'}</td>
                        <td className="px-4 py-2">
                          <Button size="sm" variant="outline" onClick={() => handleProcessOCR(r.id)} disabled={processingId === r.id}>
                            {processingId === r.id ? 'Processando...' : 'Processar OCR'}
                          </Button>
                        </td>
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

export default Deliveries; 