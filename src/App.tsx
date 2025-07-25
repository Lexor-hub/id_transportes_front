import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/dashboard";
import NotFound from "./pages/NotFound";
import React from "react";
import Users from "./pages/dashboard/Users";
import Vehicles from "./pages/dashboard/Vehicles";
import Deliveries from "./pages/dashboard/Deliveries";
import Tracking from "./pages/dashboard/Tracking";
import Reports from "./pages/dashboard/Reports";

const queryClient = new QueryClient();

// Route wrapper component to handle initial redirect
const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/usuarios" 
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/veiculos" 
        element={
          <ProtectedRoute>
            <Vehicles />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/entregas" 
        element={
          <ProtectedRoute>
            <Deliveries />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/rastreamento" 
        element={
          <ProtectedRoute>
            <Tracking />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/relatorios" 
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
