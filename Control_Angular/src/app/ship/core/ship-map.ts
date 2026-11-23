/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  popup?: string;
  tone?: 'ok' | 'warn' | 'bad' | 'navy' | 'gold';
  /** رقم يظهر داخل العلامة (ترتيب المحطة) */
  index?: number;
}

export interface MapLine {
  points: [number, number][];
  color?: string;
  dashed?: boolean;
}

const TONE: Record<string, string> = {
  ok: '#1b8a5a',
  warn: '#d49a14',
  bad: '#c0392b',
  navy: '#14324c',
  gold: '#d4a857',
};

let leafletReady: Promise<any> | null = null;

function api(): any {
  return (window as unknown as { L?: any }).L;
}

export function loadLeaflet(): Promise<any> {
  if (api()) {
    return Promise.resolve(api());
  }
  if (!leafletReady) {
    leafletReady = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset['leaflet'] = '1';
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => (api() ? resolve(api()) : reject(new Error('Leaflet missing')));
      script.onerror = () => {
        leafletReady = null;
        reject(new Error('Leaflet failed'));
      };
      document.body.appendChild(script);
    });
  }
  return leafletReady;
}

/** غلاف بسيط حول Leaflet لرسم موانئ ومسارات. */
export class ShipMap {
  private map: any = null;
  private layer: any = null;

  constructor(private readonly el: HTMLElement) {}

  async draw(markers: MapMarker[], lines: MapLine[] = [], fit = true): Promise<boolean> {
    let L: any;
    try {
      L = await loadLeaflet();
    } catch {
      return false;
    }
    if (!this.el.isConnected) {
      return false;
    }
    if (!this.map) {
      this.map = L.map(this.el, { zoomControl: true, scrollWheelZoom: false }).setView([27, 38], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 12,
      }).addTo(this.map);
    }
    if (this.layer) {
      this.layer.remove();
    }
    this.layer = L.layerGroup().addTo(this.map);
    const bounds: [number, number][] = [];

    for (const line of lines) {
      if (line.points.length > 1) {
        L.polyline(line.points, {
          color: line.color ?? '#167a82',
          weight: 3,
          opacity: 0.85,
          dashArray: line.dashed ? '7 8' : undefined,
        }).addTo(this.layer);
        bounds.push(...line.points);
      }
    }
    for (const m of markers) {
      const color = TONE[m.tone ?? 'navy'];
      const icon = L.divIcon({
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center;font:700 12px Cairo,sans-serif">${m.index ?? ''}</div>`,
      });
      const marker = L.marker([m.lat, m.lng], { icon, title: m.label }).addTo(this.layer);
      marker.bindPopup(m.popup ?? `<b>${m.label}</b>`);
      bounds.push([m.lat, m.lng]);
    }
    if (fit && bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [34, 34], maxZoom: 7 });
    } else if (bounds.length === 1) {
      this.map.setView(bounds[0], 6);
    }
    window.setTimeout(() => this.map?.invalidateSize(), 80);
    return true;
  }

  destroy(): void {
    this.map?.remove();
    this.map = null;
    this.layer = null;
  }
}
