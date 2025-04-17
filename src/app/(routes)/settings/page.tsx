'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Typography, Container, Paper, Tabs, Tab, Box, Divider, Switch, FormControlLabel } from '@mui/material';
import { styled } from '@mui/material/styles';

// Interfaz de las pestañas
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Componente para el contenido de las pestañas
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Propiedades de cada pestaña
function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

// Estilos para el contenedor principal
const SettingsContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(8),
}));

// Estilos para cada sección
const SettingsSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(10px)',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
}));

// Estilos para el título de cada sección
const SectionTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  color: theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark,
  fontWeight: 600,
}));

export default function SettingsPage() {
  // Estado para las pestañas
  const [tabValue, setTabValue] = useState(0);
  
  // Obtener estado de autenticación y preferencias
  const { isAuthenticated, isDemo } = useAuth();
  
  // Obtener traducciones e idioma actual
  const { t } = useTranslation();
  const { language } = useLanguage();
  
  // Estados para las configuraciones
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isHighQuality, setIsHighQuality] = useState(false);
  const [notifications, setNotifications] = useState(true);
  
  // Manejo de cambio de pestaña
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <SettingsContainer maxWidth="md">
      <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 4 }}>
        {t('settings.title')}
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={t('settings.general')} {...a11yProps(0)} />
          <Tab label={t('settings.account')} {...a11yProps(1)} />
          <Tab label={t('settings.notifications')} {...a11yProps(2)} />
          <Tab label={t('settings.aboutUs')} {...a11yProps(3)} />
        </Tabs>
      </Box>
      
      {/* Pestaña General */}
      <TabPanel value={tabValue} index={0}>
        {/* Sección de Idioma */}
        <SettingsSection>
          <SectionTitle variant="h6">
            {t('settings.language')}
          </SectionTitle>
          <Typography variant="body2" color="text.secondary" paragraph>
            {language === 'es' 
              ? 'Selecciona el idioma en el que quieres ver el contenido de la aplicación.' 
              : 'Select the language in which you want to see the application content.'}
          </Typography>
          
          <Box sx={{ mt: 3 }}>
            <LanguageSwitcher variant="full" />
          </Box>
        </SettingsSection>
        
        {/* Sección de Tema */}
        <SettingsSection>
          <SectionTitle variant="h6">
            {t('settings.theme')}
          </SectionTitle>
          <FormControlLabel
            control={
              <Switch
                checked={isDarkMode}
                onChange={() => setIsDarkMode(!isDarkMode)}
                color="primary"
              />
            }
            label={isDarkMode ? t('settings.dark') : t('settings.light')}
          />
        </SettingsSection>
        
        {/* Sección de Calidad de Audio */}
        <SettingsSection>
          <SectionTitle variant="h6">
            {t('settings.quality')}
          </SectionTitle>
          <FormControlLabel
            control={
              <Switch
                checked={isHighQuality}
                onChange={() => setIsHighQuality(!isHighQuality)}
                color="primary"
              />
            }
            label={isHighQuality ? "Alta calidad" : "Calidad normal"}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {isHighQuality 
              ? "La reproducción en alta calidad consume más datos."
              : "La calidad normal es adecuada para la mayoría de las conexiones."}
          </Typography>
        </SettingsSection>
      </TabPanel>
      
      {/* Pestaña de Cuenta */}
      <TabPanel value={tabValue} index={1}>
        <SettingsSection>
          <SectionTitle variant="h6">
            {t('settings.account')}
          </SectionTitle>
          {isDemo ? (
            <Typography variant="body1" color="text.secondary">
              {language === 'es'
                ? 'Estás utilizando una cuenta de demostración. Para acceder a todas las funciones, inicia sesión con tu cuenta.'
                : 'You are using a demo account. To access all features, log in with your account.'}
            </Typography>
          ) : (
            <Typography variant="body1">
              {language === 'es'
                ? 'Estás conectado con tu cuenta personal.'
                : 'You are connected with your personal account.'}
            </Typography>
          )}
        </SettingsSection>
      </TabPanel>
      
      {/* Pestaña de Notificaciones */}
      <TabPanel value={tabValue} index={2}>
        <SettingsSection>
          <SectionTitle variant="h6">
            {t('settings.notifications')}
          </SectionTitle>
          <FormControlLabel
            control={
              <Switch
                checked={notifications}
                onChange={() => setNotifications(!notifications)}
                color="primary"
              />
            }
            label={notifications ? "Notificaciones activadas" : "Notificaciones desactivadas"}
          />
        </SettingsSection>
      </TabPanel>
      
      {/* Pestaña de Acerca de */}
      <TabPanel value={tabValue} index={3}>
        <SettingsSection>
          <SectionTitle variant="h6">
            {t('settings.aboutUs')}
          </SectionTitle>
          <Typography variant="body1" paragraph>
            freevibes v1.0.0
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {language === 'es'
              ? 'Una aplicación para descubrir y disfrutar música a través de múltiples plataformas.'
              : 'An application to discover and enjoy music across multiple platforms.'}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" paragraph>
            © 2024 freevibes. {language === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'}
          </Typography>
        </SettingsSection>
      </TabPanel>
    </SettingsContainer>
  );
} 