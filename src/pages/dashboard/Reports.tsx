import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 10;

const Reports: React.FC = () => {
  // Estados para cada relatório
  const [tab, setTab] = useState('entregas');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entregas
  const [entregas, setEntregas] = useState<any[]>([]);
  const [entregasFiltro, setEntregasFiltro] = useState('');
  const [entregasPage, setEntregasPage] = useState(1);

  // Ocorrências
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [ocorrenciasFiltro, setOcorrenciasFiltro] = useState('');
  const [ocorrenciasPage, setOcorrenciasPage] = useState(1);

  // Comprovantes
  const [comprovantes, setComprovantes] = useState<any[]>([]);
  const [comprovantesFiltro, setComprovantesFiltro] = useState('');
  const [comprovantesPage, setComprovantesPage] = useState(1);

  // Desempenho
  const [desempenho, setDesempenho] = useState<any[]>([]);
  const [desempenhoFiltro, setDesempenhoFiltro] = useState('');
  const [desempenhoPage, setDesempenhoPage] = useState(1);

  // Cliente
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesFiltro, setClientesFiltro] = useState('');
  const [clientesPage, setClientesPage] = useState(1);

  // Status Diário
  const [statusDiario, setStatusDiario] = useState<any[]>([]);

  // Função para exportar dados para CSV
  const exportToCSV = (data: any[], filename: string) => {
    const csv = [Object.keys(data[0] || {}).join(','), ...data.map(row => Object.values(row).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Carregar dados ao trocar de aba
  useEffect(() => {
    setError(null);
    setLoading(true);
    const fetchData = async () => {
      try {
        if (tab === 'entregas') {
          const res = await apiService.getDeliveryReports({ search: entregasFiltro });
          setEntregas(res.data || []);
        } else if (tab === 'ocorrencias') {
          const res = await apiService.getOccurrencesReports({ search: ocorrenciasFiltro });
          setOcorrencias(res.data || []);
        } else if (tab === 'comprovantes') {
          const res = await apiService.getReceiptsReports({ search: comprovantesFiltro });
          setComprovantes(res.data || []);
        } else if (tab === 'desempenho') {
          const res = await apiService.getDriverPerformanceReports({ search: desempenhoFiltro });
          setDesempenho(res.data || []);
        } else if (tab === 'cliente') {
          const res = await apiService.getClientVolumeReports({ search: clientesFiltro });
          setClientes(res.data || []);
        } else if (tab === 'status') {
          const res = await apiService.getDailyStatus();
          setStatusDiario(res.data ? [res.data] : []);
        }
      } catch (e: any) {
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [tab, entregasFiltro, ocorrenciasFiltro, comprovantesFiltro, desempenhoFiltro, clientesFiltro]);

  // Paginação
  const paginate = (data: any[], page: number) => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = (data: any[]) => Math.ceil(data.length / PAGE_SIZE);

  return (
    <>
      <div className="container mx-auto px-4 md:px-6 py-6">
        <h1 className="text-2xl font-bold mb-4">Relatórios</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="entregas">Entregas</TabsTrigger>
            <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
            <TabsTrigger value="comprovantes">Comprovantes</TabsTrigger>
            <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
            <TabsTrigger value="status">Status Diário</TabsTrigger>
          </TabsList>

          {/* Entregas */}
          <TabsContent value="entregas">
            <Card>
              <CardHeader>
                <CardTitle>Entregas Realizadas</CardTitle>
                <form className="flex flex-col gap-2 w-full max-w-md md:flex-row md:gap-2 mt-2">
                  <Input placeholder="Buscar por NF, Cliente..." value={entregasFiltro} onChange={e => setEntregasFiltro(e.target.value)} className="w-full min-h-[44px] text-base" />
                  <Button type="button" onClick={() => exportToCSV(entregas, 'entregas.csv')} className="w-full min-h-[44px] text-base md:w-auto">Exportar CSV</Button>
                </form>
              </CardHeader>
              <CardContent>
                {loading ? <p>Carregando...</p> : error ? <p className="text-destructive">{error}</p> : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NF</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(entregas, entregasPage).map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.nfNumber}</TableCell>
                            <TableCell>{r.client}</TableCell>
                            <TableCell>{new Date(r.date).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>{r.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <Button disabled={entregasPage === 1} onClick={() => setEntregasPage(p => p - 1)}>Anterior</Button>
                  <span>Página {entregasPage} de {totalPages(entregas)}</span>
                  <Button disabled={entregasPage === totalPages(entregas)} onClick={() => setEntregasPage(p => p + 1)}>Próxima</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ocorrências */}
          <TabsContent value="ocorrencias">
            <Card>
              <CardHeader>
                <CardTitle>Ocorrências</CardTitle>
                <form className="flex flex-col gap-2 w-full max-w-md md:flex-row md:gap-2 mt-2">
                  <Input placeholder="Buscar por NF, Cliente..." value={ocorrenciasFiltro} onChange={e => setOcorrenciasFiltro(e.target.value)} className="w-full min-h-[44px] text-base" />
                  <Button type="button" onClick={() => exportToCSV(ocorrencias, 'ocorrencias.csv')} className="w-full min-h-[44px] text-base md:w-auto">Exportar CSV</Button>
                </form>
              </CardHeader>
              <CardContent>
                {loading ? <p>Carregando...</p> : error ? <p className="text-destructive">{error}</p> : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NF</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Observação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(ocorrencias, ocorrenciasPage).map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.nfNumber}</TableCell>
                            <TableCell>{r.client}</TableCell>
                            <TableCell>{new Date(r.date).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>{r.type}</TableCell>
                            <TableCell>{r.note}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <Button disabled={ocorrenciasPage === 1} onClick={() => setOcorrenciasPage(p => p - 1)}>Anterior</Button>
                  <span>Página {ocorrenciasPage} de {totalPages(ocorrencias)}</span>
                  <Button disabled={ocorrenciasPage === totalPages(ocorrencias)} onClick={() => setOcorrenciasPage(p => p + 1)}>Próxima</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comprovantes */}
          <TabsContent value="comprovantes">
            <Card>
              <CardHeader>
                <CardTitle>Comprovantes</CardTitle>
                <form className="flex flex-col gap-2 w-full max-w-md md:flex-row md:gap-2 mt-2">
                  <Input placeholder="Buscar por NF, Cliente..." value={comprovantesFiltro} onChange={e => setComprovantesFiltro(e.target.value)} className="w-full min-h-[44px] text-base" />
                  <Button type="button" onClick={() => exportToCSV(comprovantes, 'comprovantes.csv')} className="w-full min-h-[44px] text-base md:w-auto">Exportar CSV</Button>
                </form>
              </CardHeader>
              <CardContent>
                {loading ? <p>Carregando...</p> : error ? <p className="text-destructive">{error}</p> : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NF</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comprovante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(comprovantes, comprovantesPage).map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.nfNumber}</TableCell>
                            <TableCell>{r.client}</TableCell>
                            <TableCell>{new Date(r.date).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>{r.status}</TableCell>
                            <TableCell><a href={r.receiptUrl} target="_blank" rel="noopener noreferrer">Ver</a></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <Button disabled={comprovantesPage === 1} onClick={() => setComprovantesPage(p => p - 1)}>Anterior</Button>
                  <span>Página {comprovantesPage} de {totalPages(comprovantes)}</span>
                  <Button disabled={comprovantesPage === totalPages(comprovantes)} onClick={() => setComprovantesPage(p => p + 1)}>Próxima</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Desempenho */}
          <TabsContent value="desempenho">
            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Motorista</CardTitle>
                <form className="flex flex-col gap-2 w-full max-w-md md:flex-row md:gap-2 mt-2">
                  <Input placeholder="Buscar por Motorista..." value={desempenhoFiltro} onChange={e => setDesempenhoFiltro(e.target.value)} className="w-full min-h-[44px] text-base" />
                  <Button type="button" onClick={() => exportToCSV(desempenho, 'desempenho.csv')} className="w-full min-h-[44px] text-base md:w-auto">Exportar CSV</Button>
                </form>
              </CardHeader>
              <CardContent>
                {loading ? <p>Carregando...</p> : error ? <p className="text-destructive">{error}</p> : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Entregas</TableHead>
                          <TableHead>Eficiência</TableHead>
                          <TableHead>Ocorrências</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(desempenho, desempenhoPage).map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.driver}</TableCell>
                            <TableCell>{r.totalDeliveries}</TableCell>
                            <TableCell>{r.efficiency}%</TableCell>
                            <TableCell>{r.occurrences}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <Button disabled={desempenhoPage === 1} onClick={() => setDesempenhoPage(p => p - 1)}>Anterior</Button>
                  <span>Página {desempenhoPage} de {totalPages(desempenho)}</span>
                  <Button disabled={desempenhoPage === totalPages(desempenho)} onClick={() => setDesempenhoPage(p => p + 1)}>Próxima</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cliente */}
          <TabsContent value="cliente">
            <Card>
              <CardHeader>
                <CardTitle>Relatório por Cliente</CardTitle>
                <form className="flex flex-col gap-2 w-full max-w-md md:flex-row md:gap-2 mt-2">
                  <Input placeholder="Buscar por Cliente..." value={clientesFiltro} onChange={e => setClientesFiltro(e.target.value)} className="w-full min-h-[44px] text-base" />
                  <Button type="button" onClick={() => exportToCSV(clientes, 'clientes.csv')} className="w-full min-h-[44px] text-base md:w-auto">Exportar CSV</Button>
                </form>
              </CardHeader>
              <CardContent>
                {loading ? <p>Carregando...</p> : error ? <p className="text-destructive">{error}</p> : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Volume</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Mês/Ano</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginate(clientes, clientesPage).map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.client}</TableCell>
                            <TableCell>{r.volume}</TableCell>
                            <TableCell>R$ {r.value ? r.value.toFixed(2) : '0.00'}</TableCell>
                            <TableCell>{r.month}/{r.year}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-2">
                  <Button disabled={clientesPage === 1} onClick={() => setClientesPage(p => p - 1)}>Anterior</Button>
                  <span>Página {clientesPage} de {totalPages(clientes)}</span>
                  <Button disabled={clientesPage === totalPages(clientes)} onClick={() => setClientesPage(p => p + 1)}>Próxima</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Status Diário */}
          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>Status Diário</CardTitle>
                <Button type="button" onClick={() => exportToCSV(statusDiario, 'status_diario.csv')} className="w-full min-h-[44px] text-base md:w-auto">Exportar CSV</Button>
              </CardHeader>
              <CardContent>
                {loading ? <p>Carregando...</p> : error ? <p className="text-destructive">{error}</p> : (
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {statusDiario[0] && Object.keys(statusDiario[0]).map((key) => (
                            <TableHead key={key}>{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusDiario.map((r: any, idx: number) => (
                          <TableRow key={idx}>
                            {Object.values(r).map((val, i) => (
                              <TableCell key={i}>{val}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Reports; 