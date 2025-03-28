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
    return response.data;
  }
} 