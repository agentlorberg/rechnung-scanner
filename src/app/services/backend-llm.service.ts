import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RechnungsAnalyse } from './llm-analysis.service';

@Injectable({ providedIn: 'root' })
export class BackendLlmService {
  // Backend URL (VPS)
  private backendUrl = 'http://187.124.15.163:57692/api';

  constructor(private http: HttpClient) {}

  async analysiereRechnung(pdfBase64: string, dateiname: string): Promise<RechnungsAnalyse> {
    // Sende an unseren Backend-Server
    const response = await this.http.post<RechnungsAnalyse>(
      `${this.backendUrl}/analyze`,
      { text: `Rechnung: ${dateiname}` } // Für Demo-Validierung
    ).toPromise();
    
    return response!;
  }

  checkHealth(): Promise<boolean> {
    return this.http.get(`${this.backendUrl}/health`)
      .toPromise()
      .then(() => true)
      .catch(() => false);
  }
}
