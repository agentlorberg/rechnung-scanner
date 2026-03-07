import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LlmAnalysisService, RechnungsAnalyse } from '../services/llm-analysis.service';
import { StorageService, RechnungsHistorie } from '../services/storage.service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class HomePage {
  currentAnalyse: RechnungsAnalyse | null = null;
  historie: RechnungsHistorie[] = [];
  isLoading = false;
  selectedTab: 'upload' | 'ergebnis' | 'historie' | 'details' = 'upload';
  selectedEintrag: RechnungsHistorie | null = null;
  
  // Charts
  scoreChart: any;
  plausibilitaetChart: any;

  bemerkungInput = '';

  constructor(
    private llmService: LlmAnalysisService,
    private storage: StorageService
  ) {}

  ngOnInit() {
    this.ladeHistorie();
  }

  async ladeHistorie() {
    this.historie = await this.storage.ladeAlleEintraege();
  }

  async fotoAufnehmen() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });
      await this.analysiereBild(image.base64String || '');
    } catch (e) {
      console.error('Kamera Fehler:', e);
    }
  }

  async dateiHochladen(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      await this.analysiereBild(base64, file.name);
    };
    reader.readAsDataURL(file);
  }

  async analysiereBild(base64: string, dateiname?: string) {
    this.isLoading = true;
    this.selectedTab = 'upload';

    const pdfText = 'Extrahiert aus: ' + (dateiname || 'Bild');
    
    const analyse = await this.llmService.analysiereRechnung(pdfText);
    this.currentAnalyse = analyse;
    
    const eintrag: RechnungsHistorie = {
      id: crypto.randomUUID(),
      dateiname: dateiname || `Scan_${new Date().toISOString()}`,
      datum: new Date().toISOString(),
      analyse: analyse,
      pdfBase64: base64
    };
    
    await this.storage.speichereRechnung(eintrag);
    await this.ladeHistorie();
    
    this.isLoading = false;
    this.selectedTab = 'ergebnis';
    
    setTimeout(() => this.erstelleCharts(), 100);
  }

  zeigeDetails(eintrag: RechnungsHistorie) {
    this.selectedEintrag = eintrag;
    this.currentAnalyse = eintrag.analyse;
    this.selectedTab = 'details';
    setTimeout(() => this.erstelleCharts(), 100);
  }

  private erstelleCharts() {
    if (!this.currentAnalyse) return;

    const ctx1 = document.getElementById('scoreChart') as HTMLCanvasElement;
    if (ctx1) {
      if (this.scoreChart) this.scoreChart.destroy();
      this.scoreChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['Score', 'Rest'],
          datasets: [{
            data: [this.currentAnalyse.gesamteindruck, 10 - this.currentAnalyse.gesamteindruck],
            backgroundColor: ['#4CAF50', '#E0E0E0'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: 'Gesamteindruck' },
            legend: { display: false }
          }
        }
      });
    }
  }

  getBewertungText(score: number): string {
    if (score >= 9) return 'Exzellent';
    if (score >= 7) return 'Gut';
    if (score >= 5) return 'Akzeptabel';
    if (score >= 3) return 'Mangelhaft';
    return 'Kritisch';
  }

  getBewertungFarbe(score: number): string {
    if (score >= 7) return 'success';
    if (score >= 4) return 'warning';
    return 'danger';
  }

  zurueckZuHistorie() {
    this.selectedEintrag = null;
    this.currentAnalyse = null;
    this.selectedTab = 'historie';
  }

  async eintragLoeschen(id: string, event: Event) {
    event.stopPropagation();
    await this.storage.loescheEintrag(id);
    await this.ladeHistorie();
  }
}
