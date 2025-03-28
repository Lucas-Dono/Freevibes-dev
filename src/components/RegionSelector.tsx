import { useState, useEffect } from 'react';
import { setUserRegion, getCountryCode } from '@/lib/utils';

// Lista de países con sus códigos
const COUNTRIES = [
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'ES', name: 'España' },
  { code: 'MX', name: 'México' },
  { code: 'PE', name: 'Perú' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'DE', name: 'Alemania' },
  { code: 'FR', name: 'Francia' },
  { code: 'IT', name: 'Italia' },
  { code: 'GB', name: 'Reino Unido' },
];

export default function RegionSelector() {
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // Obtener la región actual al cargar el componente
    const currentRegion = getCountryCode();
    setSelectedRegion(currentRegion);
  }, []);

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRegion(e.target.value);
  };

  const handleSave = () => {
    if (selectedRegion) {
      setUserRegion(selectedRegion);
      setShowDialog(false);
      // Recargar la página para aplicar la nueva región
      window.location.reload();
    }
  };

  const toggleDialog = () => {
    setShowDialog(!showDialog);
  };

  // Buscar el nombre del país por código
  const getCountryName = (code: string) => {
    const country = COUNTRIES.find(c => c.code === code);
    return country ? country.name : code;
  };

  return (
    <div className="relative">
      <button 
        onClick={toggleDialog}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
      >
        <span className="text-xs">{getCountryName(selectedRegion)}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>

      {showDialog && (
        <div className="absolute right-0 top-full mt-2 p-4 z-50 bg-white dark:bg-gray-900 shadow-lg rounded-md w-64">
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm">Selecciona tu región</h3>
            
            <div className="mb-2">
              <label htmlFor="region" className="block text-xs mb-1">
                País
              </label>
              <select
                id="region"
                value={selectedRegion}
                onChange={handleRegionChange}
                className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-sm"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDialog(false)}
                className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 