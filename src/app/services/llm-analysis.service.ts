import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface RechnungsAnalyse {
  gesamteindruck: number; // 0-10
  qualitaetInterpretation: number; // 0-10
  positionen: Array<{
    bezeichnung: string;
    menge: number;
    einzelpreis: number;
    gesamtpreis: number;
    plausibel: boolean;
  }>;
  zwischensummen: Array<{
    betrag: number;
    bezeichnung: string;
    korrekt: boolean;
  }>;
  mwst: {
    saetze: Array<{ satz: number; betrag: number }>;
    gesamtMwst: number;
    korrektBerechnet: boolean;
  };
  endbetrag: number;
  stimmtEndbetrag: boolean;
  bemerkungen: string[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class LlmAnalysisService {
  private apiUrl = 'https://api.openai.com/v1/chat/completions';
  private apiKey = 'DEIN_API_KEY_HIER'; // TODO: Aus Konfiguration laden

  constructor(private http: HttpClient) {}

  async analysiereRechnung(pdfText: string): Promise<RechnungsAnalyse> {
    const prompt = this.bauePrompt(pdfText);
    
    // Für Demo/Testing: Simulierte Antwort wenn kein Key
    if (this.apiKey === 'DEIN_API_KEY_HIER') {
      return this.simuliereAnalyse(pdfText);
    }

    try {
      const response = await this.sendeAnfrage(prompt);
      return this.parseAntwort(response);
    } catch (error) {
      console.error('LLM Fehler:', error);
      return this.simulierteFehlerAnalyse();
    }
  }

  private bauePrompt(text: string): string {
    return `Analysiere folgende Rechnung und validiere sie:

${text}

Bitte antworte im JSON-Format:
{
  "gesamteindruck": 0-10,
  "qualitaetInterpretation": 0-10,
  "positionen": [
    {
      "bezeichnung": "string",
      "menge": number,
      "einzelpreis": number,
      "gesamtpreis": number,
      "plausibel": boolean
    }
  ],
  "zwischensummen": [
    {
      "betrag": number,
      "bezeichnung": "string",
      "korrekt": boolean
    }
  ],
  "mwst": {
    "saetze": [{"satz": 19, "betrag": number}],
    "gesamtMwst": number,
    "korrektBerechnet": boolean
  },
  "endbetrag": number,
  "stimmtEndbetrag": boolean,
  "bemerkungen": ["string"],
  "warnings": ["string"]
}

Prüfe:
1. Menge × Einzelpreis = Gesamtpreis bei jeder Position
2. Summe aller Positionen = Zwischensumme
3. MWST-Berechnung korrekt
4. Endbetrag = Zwischensumme + MWST
5. Gib einen Score 0-10 für Gesamteindruck
6. Gib einen Score 0-10 für Qualität der Datenextraktion`;
  }

  private async sendeAnfrage(prompt: string): Promise<any> {
    return this.http.post(this.apiUrl, {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Du bist ein Experte für Rechnungsprüfung. Analysiere Rechnungen präzise und gib strukturierte JSON-Antworten.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    }).toPromise();
  }

  private parseAntwort(response: any): RechnungsAnalyse {
    return JSON.parse(response.choices[0].message.content);
  }

  // Demo-Funktion wenn kein API Key
  private simuliereAnalyse(text: string): RechnungsAnalyse {
    return {
      gesamteindruck: 8.5,
      qualitaetInterpretation: 9.0,
      positionen: [
        {
          bezeichnung: 'Beispielposition',
          menge: 2,
          einzelpreis: 100.00,
          gesamtpreis: 200.00,
          plausibel: true
        }
      ],
      zwischensummen: [
        { betrag: 200.00, bezeichnung: 'Netto', korrekt: true }
      ],
      mwst: {
        saetze: [{ satz: 19, betrag: 38.00 }],
        gesamtMwst: 38.00,
        korrektBerechnet: true
      },
      endbetrag: 238.00,
      stimmtEndbetrag: true,
      bemerkungen: ['Rechnung sieht plausibel aus', 'Alle Berechnungen korrekt'],
      warnings: ['Kein Logo vorhanden']
    };
  }

  private simulierteFehlerAnalyse(): RechnungsAnalyse {
    return {
      gesamteindruck: 3.0,
      qualitaetInterpretation: 2.0,
      positionen: [],
      zwischensummen: [],
      mwst: { saetze: [], gesamtMwst: 0, korrektBerechnet: false },
      endbetrag: 0,
      stimmtEndbetrag: false,
      bemerkungen: ['Fehler bei Analyse'],
      warnings: ['API Key fehlt oder ungültig']
    };
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }
}
