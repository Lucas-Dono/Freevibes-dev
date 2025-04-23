import React, { useState, useEffect, useRef } from 'react';

// Función de debounce para evitar demasiadas llamadas a la API
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Actualizar el valor debounced después del tiempo de retraso
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancelar el timeout si el valor cambia o el componente se desmonta
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchInput({ onSearch, placeholder = "Buscar en todo..." }: SearchInputProps) {
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Aplicar debounce al valor de búsqueda (500ms)
  const debouncedSearchValue = useDebounce(searchValue, 500);

  // Referencia para cancelar búsquedas en curso
  const searchRequestRef = useRef<AbortController | null>(null);

  // Efecto para realizar la búsqueda cuando el valor debounced cambia
  useEffect(() => {
    // Solo buscar si hay un valor
    if (debouncedSearchValue && debouncedSearchValue.trim() !== '') {
      // Cancelar solicitudes previas
      if (searchRequestRef.current) {
        searchRequestRef.current.abort();
      }

      // Crear un nuevo controller para esta búsqueda
      searchRequestRef.current = new AbortController();

      setIsSearching(true);

      // Realizar la búsqueda
      const performSearch = async () => {
        try {
          // Simular un retraso para mostrar el indicador de carga
          await new Promise(resolve => setTimeout(resolve, 300));

          // Llamar a la función de búsqueda proporcionada
          onSearch(debouncedSearchValue);
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error('Error al realizar la búsqueda:', error);
          }
        } finally {
          setIsSearching(false);
        }
      };

      performSearch();
    }
  }, [debouncedSearchValue, onSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  return (
    <div className="search-input-container">
      <input
        type="text"
        value={searchValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="search-input"
      />
      {isSearching && <div className="search-loading-indicator">Buscando...</div>}
    </div>
  );
}
