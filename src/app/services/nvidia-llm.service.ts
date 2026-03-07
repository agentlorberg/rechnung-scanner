import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RechnungsAnalyse } from './llm-analysis.service';

export interface NvidiaLlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class NvidiaLlmService {
  private config: NvidiaLlmConfig = {
    apiKey: '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',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia/moonshotai/kimi-k2.5'
  };

  constructor(private http: HttpClient) {}

  async analysiereRechnungMitLLM(pdfText: string): Promise<RechnungsAnalyse> {
    if (!this.config.apiKey || this.config.apiKey === 'DEIN_API_KEY') {
      throw new Error('NVIDIA API Key nicht konfiguriert');
    }

    const prompt = this.bauePrompt(pdfText);
    
    try {
      console.log('Sende Anfrage an NVIDIA LLM...');
      const response = await this.sendeNvidiaAnfrage(prompt);
      return this.parseAntwort(response);
    } catch (error) {
      console.error('NVIDIA LLM Fehler:', error);
      throw new Error('LLM-Analyse fehlgeschlagen: ' + (error as Error).message);
    }
  }

  private bauePrompt(text: string): string {
    return `ANALYSE EINER RECHNUNG - Experten-Level Validierung

Eingabedaten (aus PDF extrahiert):
${text}

AUFGABE:
Analysiere diese Rechnung wie ein erfahrener Buchhalter. Extrahiere alle Positionen, berechne Zwischensummen, prüfe MWST-Sätze und validiere den Endbetrag.

WICHTIGE REGELN:
- Positionen: Menge × Einzelpreis MUSS = Gesamtpreis sein
- Netto-Zwischensumme: Summe aller Positionen
- MWST: Meist 19%, manchmal 7% oder 0%
- Brutto-Endbetrag: Netto + MWST
- Belege alle Berechnungen

ANTWORTFORMAT (JSON):
{
  "gesamteindruck": number (0-10, wie professionell/korrekt wirkt die Rechnung),
  "qualitaetInterpretation": number (0-10, wie gut konnte ich die Daten extrahieren),
  "positionen": [
    {
      "bezeichnung": "string (Produkt/Dienstleistung)",
      "menge": number,
      "einzelpreis": number,
      "gesamtpreis": number,
      "plausibel": boolean (menge×einzelpreis ≈ gesamtpreis)")
    }
  ],
  "zwischensummen": [
    {
      "betrag": number,
      "bezeichnung": "string (z.B. 'Nettosumme', 'Zwischensumme')",
      "korrekt": boolean
    }
  ],
  "mwst": {
    "saetze": [{"satz": number (19 oder 7 oder 0), "betrag": number}],
    "gesamtMwst": number,
    "korrektBerechnet": boolean
  },
  "endbetrag": number,
  "stimmtEndbetrag": boolean,
  "bemerkungen": ["string array mit positiven Erkenntnissen"],
  "warnings": ["string array mit Warnungen/Unstimmigkeiten"]
}

Beispiel für richtige Berechnung:
- 2×100€ = 200€ Netto
- MWST 19% = 38€
- Brutto = 238€

Antworte NUR mit dem JSON-Objekt, keine Erklärungen davor oder danach.`;
  }

  private async sendeNvidiaAnfrage(prompt: string): Promise<any> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const body = {
      model: this.config.model,
      messages: [
        { 
          role: 'system', 
          content: 'Du bist ein präziser Rechnungsanalyzer. Du validierst Rechnungen auf mathematische Korrektheit und Plausibilität. Du antwortest NUR im JSON-Format.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    };

    const response = await this.http.post(url, body, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).toPromise();

    return response;
  }

  private parseAntwort(response: any): RechnungsAnalyse {
    try {
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      
      // Validierung der Struktur
      this.validiereStruktur(parsed);
      
      return parsed as RechnungsAnalyse;
    } catch (error) {
      console.error('Parsing-Fehler:', error);
      console.log('Rohantwort:', response);
      throw new Error('Konnte LLM-Antwort nicht parsen');
    }
  }

  private validiereStruktur(data: any): void {
    const erforderlich = [
      'gesamteindruck', 'qualitaetInterpretation', 'positionen', 
      'zwischensummen', 'mwst', 'endbetrag', 'stimmtEndbetrag'
    ];
    
    for (const field of erforderlich) {
      if (!(field in data)) {
        throw new Error(`Fehlendes Feld: ${field}`);
      }
    }

    // Score-Ranges prüfen
    if (data.gesamteindruck < 0 || data.gesamteindruck > 10) {
      throw new Error('gesamteindruck muss zwischen 0-10 sein');
    }
    if (data.qualitaetInterpretation < 0 || data.qualitaetInterpretation > 10) {
      throw new Error('qualitaetInterpretation muss zwischen 0-10 sein');
    }
  }

  // Test-Methode für Selbstvalidierung
  async testeVerbindung(): Promise<boolean> {
    try {
      const testPrompt = 'Antworte mit: {"status": "ok"}';
      await this.sendeNvidiaAnfrage(testPrompt);
      return true;
    } catch {
      return false;
    }
  }
}
