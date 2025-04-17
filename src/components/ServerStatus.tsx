'use client';

import React, { useState, useEffect } from 'react';
import { Button, Box, Typography, Alert, Chip, CircularProgress, Collapse, IconButton } from '@mui/material';
import { isNodeServerAvailable, isPythonApiAvailable, isDemoAvailable } from '@/lib/server-utils';
import { Check, Close, Error as ErrorIcon, Refresh, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { env } from '@/env.mjs';

interface ServerStatusProps {
  showDetailed?: boolean;
}

export default function ServerStatus({ showDetailed = false }: ServerStatusProps) {
  const [nodeAvailable, setNodeAvailable] = useState<boolean | null>(null);
  const [pythonAvailable, setPythonAvailable] = useState<boolean | null>(null);
  const [demoAvailable, setDemoAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(showDetailed);
  
  const checkServers = async () => {
    setLoading(true);
    
    try {
      // Comprobar los servidores en paralelo
      const [nodeResult, pythonResult, demoResult] = await Promise.all([
        isNodeServerAvailable(),
        isPythonApiAvailable(),
        isDemoAvailable()
      ]);
      
      setNodeAvailable(nodeResult);
      setPythonAvailable(pythonResult);
      setDemoAvailable(demoResult);
    } catch (error) {
      console.error('Error al comprobar servidores:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    checkServers();
  }, []);
  
  const getStatusText = () => {
    if (loading) return 'Comprobando servidores...';
    if (nodeAvailable === null) return 'Estado desconocido';
    
    if (nodeAvailable && pythonAvailable) {
      return 'Todos los servicios disponibles';
    } else if (nodeAvailable) {
      return 'Servidor Node disponible, API Python no disponible';
    } else if (demoAvailable) {
      return 'Modo Demo activo, servidores externos no disponibles';
    } else {
      return 'Servidores no disponibles';
    }
  };
  
  const getStatusSeverity = (): 'success' | 'warning' | 'error' | 'info' => {
    if (loading || nodeAvailable === null) return 'info';
    if (nodeAvailable && pythonAvailable) return 'success';
    if (nodeAvailable || demoAvailable) return 'warning';
    return 'error';
  };
  
  const StatusIcon = () => {
    if (loading) return <CircularProgress size={16} />;
    if (nodeAvailable === null) return <ErrorIcon />;
    if (nodeAvailable && pythonAvailable) return <Check />;
    if (nodeAvailable || demoAvailable) return <ErrorIcon color="warning" />;
    return <Close color="error" />;
  };
  
  return (
    <Box sx={{ mb: 2 }}>
      <Alert 
        severity={getStatusSeverity()}
        icon={<StatusIcon />}
        action={
          <Box>
            {!loading && (
              <IconButton 
                size="small" 
                onClick={() => setExpanded(!expanded)}
                sx={{ mr: 1 }}
              >
                {expanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            )}
            <IconButton 
              size="small" 
              onClick={checkServers}
              disabled={loading}
            >
              <Refresh />
            </IconButton>
          </Box>
        }
      >
        <Typography variant="body2">{getStatusText()}</Typography>
      </Alert>
      
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" gutterBottom>Detalles del servidor:</Typography>
          
          <Box display="flex" alignItems="center" mb={0.5}>
            <Chip 
              size="small"
              label="Servidor Node"
              color={nodeAvailable ? "success" : "error"}
              sx={{ mr: 1 }}
            />
            <Typography variant="body2">
              {nodeAvailable 
                ? "Disponible" 
                : `No disponible (${env.NODE_SERVER_URL || process.env.NEXT_PUBLIC_NODE_SERVER_URL || 'http://localhost:3001'})`}
            </Typography>
          </Box>
          
          <Box display="flex" alignItems="center" mb={0.5}>
            <Chip 
              size="small"
              label="API Python"
              color={pythonAvailable ? "success" : "error"}
              sx={{ mr: 1 }}
            />
            <Typography variant="body2">
              {pythonAvailable 
                ? "Disponible" 
                : `No disponible (${env.PYTHON_API_URL || process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5000'})`}
            </Typography>
          </Box>
          
          <Box display="flex" alignItems="center">
            <Chip 
              size="small"
              label="Modo Demo"
              color={demoAvailable ? "success" : "warning"}
              sx={{ mr: 1 }}
            />
            <Typography variant="body2">
              {demoAvailable 
                ? "Activo" 
                : "No disponible"}
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
} 