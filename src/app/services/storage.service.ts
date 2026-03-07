import { Injectable } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { RechnungsAnalyse } from './llm-analysis.service';

export interface RechnungsHistorie {
  id: string;
  dateiname: string;
  datum: string;
  analyse: RechnungsAnalyse;
  pdfBase64?: string;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly HISTORIE_KEY = 'rechnungen_historie';

  async speichereRechnung(historie: RechnungsHistorie): Promise<void> {
    const eintraege = await this.ladeAlleEintraege();
    eintraege.unshift(historie);
    
    await Filesystem.writeFile({
      path: `${this.HISTORIE_KEY}.json`,
      data: JSON.stringify(eintraege),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
  }

  async ladeAlleEintraege(): Promise<RechnungsHistorie[]> {
    try {
      const result = await Filesystem.readFile({
        path: `${this.HISTORIE_KEY}.json`,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      return JSON.parse(result.data as string);
    } catch (e) {
      return [];
    }
  }

  async ladeEintragById(id: string): Promise<RechnungsHistorie | null> {
    const eintraege = await this.ladeAlleEintraege();
    return eintraege.find(e => e.id === id) || null;
  }

  async loescheEintrag(id: string): Promise<void> {
    const eintraege = await this.ladeAlleEintraege();
    const gefiltert = eintraege.filter(e => e.id !== id);
    
    await Filesystem.writeFile({
      path: `${this.HISTORIE_KEY}.json`,
      data: JSON.stringify(gefiltert),
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
  }
}
