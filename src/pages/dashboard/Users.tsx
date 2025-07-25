import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { apiService } from '@/services/api';
import { User } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role: 'ADMINISTRADOR' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', username: '', role: 'ADMINISTRADOR' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const response = await apiService.getUsers();
    if (response.success && response.data) {
      setUsers(response.data);
    } else {
      setError(response.error || 'Erro ao carregar usuários');
    }
    setLoading(false);
  };

  const handleOpenModal = () => {
    setForm({ name: '', email: '', username: '', password: '', role: 'ADMINISTRADOR' });
    setFormError(null);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    if (!form.name || !form.email || !form.username || !form.password) {
      setFormError('Preencha todos os campos obrigatórios.');
      setSaving(false);
      return;
    }
    const response = await apiService.createUser(form);
    if (response.success && response.data) {
      setShowModal(false);
      fetchUsers();
    } else {
      setFormError(response.error || 'Erro ao cadastrar usuário');
    }
    setSaving(false);
  };

  const handleOpenEditModal = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
    });
    setEditError(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    setEditError(null);
    if (!editForm.name || !editForm.email || !editForm.username) {
      setEditError('Preencha todos os campos obrigatórios.');
      setEditSaving(false);
      return;
    }
    const response = await apiService.updateUser(editUser.id, editForm);
    if (response.success && response.data) {
      setEditUser(null);
      fetchUsers();
    } else {
      setEditError(response.error || 'Erro ao editar usuário');
    }
    setEditSaving(false);
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    const response = await apiService.updateUser(user.id, { ...user, status: newStatus });
    if (response.success && response.data) {
      fetchUsers();
    } else {
      alert(response.error || 'Erro ao atualizar status do usuário');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
          <Button onClick={handleOpenModal}>Novo Usuário</Button>
        </div>
        {loading ? (
          <p>Carregando usuários...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Usuários do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">E-mail</th>
                      <th className="px-4 py-2 text-left">Perfil</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">{user.name}</td>
                        <td className="px-4 py-2">{user.email}</td>
                        <td className="px-4 py-2">{user.role}</td>
                        <td className="px-4 py-2">{user.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</td>
                        <td className="px-4 py-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenEditModal(user)}>Editar</Button>
                          <Button size="sm" variant={user.status === 'ATIVO' ? 'destructive' : 'success'} onClick={() => handleToggleStatus(user)}>
                            {user.status === 'ATIVO' ? 'Desativar' : 'Ativar'}
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
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="name" placeholder="Nome" value={form.name} onChange={handleChange} required />
            <Input name="email" placeholder="E-mail" value={form.email} onChange={handleChange} required />
            <Input name="username" placeholder="Usuário" value={form.username} onChange={handleChange} required />
            <Input name="password" placeholder="Senha" type="password" value={form.password} onChange={handleChange} required />
            <select name="role" value={form.role} onChange={handleChange} className="w-full border rounded px-3 py-2">
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="MOTORISTA">Motorista</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="OPERADOR">Operador</option>
              <option value="CLIENTE">Cliente</option>
            </select>
            {formError && <p className="text-destructive text-sm">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input name="name" placeholder="Nome" value={editForm.name} onChange={handleEditChange} required />
            <Input name="email" placeholder="E-mail" value={editForm.email} onChange={handleEditChange} required />
            <Input name="username" placeholder="Usuário" value={editForm.username} onChange={handleEditChange} required />
            <select name="role" value={editForm.role} onChange={handleEditChange} className="w-full border rounded px-3 py-2">
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="MOTORISTA">Motorista</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="OPERADOR">Operador</option>
              <option value="CLIENTE">Cliente</option>
            </select>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)} disabled={editSaving}>Cancelar</Button>
              <Button type="submit" disabled={editSaving}>{editSaving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users; 