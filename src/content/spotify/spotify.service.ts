import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface SpotifyResponse<T> {
  data: T;
  status: number;
}

@Injectable()
export class SpotifyService {
  constructor(private readonly httpService: HttpService) {}

  private async makeRequest<T>(url: string, accessToken: string): Promise<T> {
    const response = await firstValueFrom(
      this.httpService.get<SpotifyResponse<T>>(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
    );

    // Extraer los datos de la respuesta
    if (response.data && typeof response.data === 'object') {
      // Si 'data' es una propiedad de la respuesta, es nuestro tipo SpotifyResponse
      if ('data' in response.data) {
        return (response.data as any).data;
      }

      // Si no hay una propiedad 'data', asumimos que la respuesta es directamente T
      return response.data as unknown as T;
    }

    // Fallback
    return response.data as unknown as T;
  }
}
