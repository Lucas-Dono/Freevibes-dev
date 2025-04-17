import React from 'react';
import { Select, MenuItem, SelectProps, SelectChangeEvent } from '@mui/material';
import { getCountryCode } from '@/lib/utils';

// Lista de países populares - se puede ampliar según necesidad
const POPULAR_COUNTRIES = [
  { code: 'ZZ', name: 'Global' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Perú' },
  { code: 'BR', name: 'Brasil' },
  { code: 'GB', name: 'Reino Unido' },
  { code: 'FR', name: 'Francia' },
  { code: 'DE', name: 'Alemania' },
  { code: 'IT', name: 'Italia' },
  { code: 'JP', name: 'Japón' },
  { code: 'KR', name: 'Corea del Sur' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canadá' }
];

// Tipo personalizado para nuestro Select de países
type CustomSelectProps = Omit<SelectProps<string>, 'onChange'> & {
  onChange?: (countryCode: string) => void;
};

export default function CountrySelector({ value, onChange, ...props }: CustomSelectProps) {
  // Si no se proporciona un valor, usar el código de país del navegador
  const [selectedCountry, setSelectedCountry] = React.useState<string>(
    value || getCountryCode() || 'ES'
  );
  
  React.useEffect(() => {
    if (value && value !== selectedCountry) {
      setSelectedCountry(value);
    }
  }, [value]);
  
  const handleChange = (event: SelectChangeEvent<string>, child: React.ReactNode) => {
    const newValue = event.target.value;
    setSelectedCountry(newValue);
    
    if (onChange) {
      onChange(newValue);
    }
  };
  
  return (
    <Select<string>
      value={selectedCountry}
      onChange={handleChange}
      sx={{
        minWidth: 150,
        '.MuiSelect-select': {
          display: 'flex',
          alignItems: 'center',
        }
      }}
      {...props}
    >
      {POPULAR_COUNTRIES.map((country) => (
        <MenuItem key={country.code} value={country.code}>
          {country.name}
        </MenuItem>
      ))}
    </Select>
  );
} 