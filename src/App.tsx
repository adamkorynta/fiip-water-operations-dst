import { ReactNode, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Gauge,
  Layers,
  Map as MapIcon,
  MountainSnow,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { Basin, BasinId, OperationPin, Status, WaterYear, basins, criteria } from "./data";

const statusRank: Record<Status, number> = { ok: 0, watch: 1, warning: 2, critical: 3 };

function formatAf(value: number) {
  return `${Math.round(value).toLocaleString()} AF`;
}

function statusLabel(status: Status) {
  return status === "ok" ? "On track" : status === "watch" ? "Watch" : status === "warning" ? "Warning" : "Critical";
}

function statusFromMargin(margin: number): Status {
  if (margin >= 10000) return "ok";
  if (margin >= 0) return "watch";
  if (margin >= -9000) return "warning";
  return "critical";
}

function useScenario(basin: Basin, waterYear: WaterYear, demandAdjustment: number, lossAdjustment: number) {
  return useMemo(() => {
    const yearFactor = waterYear === "dry" ? 0.82 : waterYear === "wet" ? 1.18 : 1;
    const adjustedSupply = basin.forecastAf * yearFactor;
    const adjustedDemand = basin.demandAf * (1 + demandAdjustment / 100);
    const conveyanceLoss = adjustedDemand * ((basin.conveyanceLossPercent + lossAdjustment) / 100);
    const deliveryNeed = adjustedDemand + conveyanceLoss;
    const margin = adjustedSupply - deliveryNeed;
    const rdaUse = Math.min(deliveryNeed, basin.rdaAf * 1.08);
    const rdaRemaining = basin.rdaAf - rdaUse;
    const flowDeficits = basin.flowPoints.filter((point) => point.currentCfs < point.mefCfs);
    const reservoirDeficits = basin.reservoirs.filter((reservoir) => reservoir.storageAf < reservoir.minPoolAf * 1.15);
    const status = [statusFromMargin(margin), flowDeficits.length ? "critical" : "ok", reservoirDeficits.length ? "warning" : "ok"].sort(
      (a, b) => statusRank[b as Status] - statusRank[a as Status],
    )[0] as Status;

    const recommendation =
      status === "critical"
        ? "Hold or reduce secondary diversions until MEF compliance and supply margin recover."
        : status === "warning"
          ? "Stage deliveries by turnout priority and preserve storage above minimum-pool buffers."
          : status === "watch"
            ? "Proceed with planned deliveries while monitoring forecast and ET trend."
            : "Current plan supports deliveries with reserve supply for adaptive operations.";

    return { adjustedSupply, adjustedDemand, conveyanceLoss, deliveryNeed, margin, rdaUse, rdaRemaining, status, flowDeficits, reservoirDeficits, recommendation };
  }, [basin, waterYear, demandAdjustment, lossAdjustment]);
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill status-pill--${status}`}>{statusLabel(status)}</span>;
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <section className="metric-card">
      <div className="metric-card__icon">{icon}</div>
      <div>
        <div className="metric-card__label">{label}</div>
        <div className="metric-card__value">{value}</div>
        <div className="metric-card__detail">{detail}</div>
      </div>
    </section>
  );
}

function BasinTabs({ activeId, onSelect }: { activeId: BasinId; onSelect: (id: BasinId) => void }) {
  return (
    <div className="basin-tabs" role="tablist" aria-label="FIIP geographic areas">
      {basins.map((basin) => (
        <button key={basin.id} className={basin.id === activeId ? "active" : ""} onClick={() => onSelect(basin.id)} type="button">
          <span>{basin.name}</span>
          <small>Operating area</small>
        </button>
      ))}
    </div>
  );
}

function markerIcon(pin: OperationPin) {
  return L.divIcon({
    className: "",
    html: `
      <span class="leaflet-labeled-pin">
        <span class="leaflet-pin leaflet-pin--${pin.kind} leaflet-pin--${pin.status}" aria-hidden="true"></span>
        <span class="leaflet-pin-label">${pin.name}</span>
      </span>
    `,
    iconSize: [180, 32],
    iconAnchor: [12, 16],
    popupAnchor: [0, -12],
  });
}

function MapViewSync({ basin }: { basin: Basin }) {
  const map = useMap();

  useEffect(() => {
    map.setView(basin.mapCenter, basin.mapZoom, { animate: true });
  }, [basin, map]);

  return null;
}

function OperationsMap({ basin }: { basin: Basin }) {
  return (
    <section className="card h-100">
      <div className="card-header d-flex align-items-center gap-2">
        <MapIcon size={18} />
        Operations Map
      </div>
      <div className="card-body">
        <MapContainer center={basin.mapCenter} zoom={basin.mapZoom} scrollWheelZoom={true} className="operations-leaflet" aria-label={`${basin.name} operations map`}>
          <MapViewSync basin={basin} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {basin.mapPins.map((pin) => (
            <Marker key={`${pin.name}-${pin.lat}-${pin.lng}`} position={[pin.lat, pin.lng]} icon={markerIcon(pin)}>
              <Popup>
                <div className="map-popup">
                  <strong>{pin.name}</strong>
                  <span>{pin.kind}</span>
                  <p>{pin.detail}</p>
                  <StatusPill status={pin.status} />
                  <small>{pin.source}</small>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div className="map-legend" aria-label="Map marker legend">
          <span><i className="leaflet-pin leaflet-pin--reservoir leaflet-pin--ok" /> Reservoir</span>
          <span><i className="leaflet-pin leaflet-pin--stream leaflet-pin--watch" /> Flow point</span>
          <span><i className="leaflet-pin leaflet-pin--diversion leaflet-pin--warning" /> Diversion</span>
        </div>
      </div>
    </section>
  );
}

function SupplyDemandBar({ supply, demand, loss }: { supply: number; demand: number; loss: number }) {
  const max = Math.max(supply, demand + loss);
  const supplyPct = Math.min(100, (supply / max) * 100);
  const demandPct = Math.min(100, (demand / max) * 100);
  const lossPct = Math.min(100 - demandPct, (loss / max) * 100);

  return (
    <div className="balance-bars">
      <div>
        <div className="balance-bars__label">
          <span>Forecast supply</span>
          <strong>{formatAf(supply)}</strong>
        </div>
        <div className="balance-bars__track">
          <span className="balance-bars__supply" style={{ width: `${supplyPct}%` }} />
        </div>
      </div>
      <div>
        <div className="balance-bars__label">
          <span>Demand + conveyance loss</span>
          <strong>{formatAf(demand + loss)}</strong>
        </div>
        <div className="balance-bars__track">
          <span className="balance-bars__demand" style={{ width: `${demandPct}%` }} />
          <span className="balance-bars__loss" style={{ width: `${lossPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function ModelRunPanel({
  basin,
  scenario,
  waterYear,
  demandAdjustment,
  lossAdjustment,
}: {
  basin: Basin;
  scenario: ReturnType<typeof useScenario>;
  waterYear: WaterYear;
  demandAdjustment: number;
  lossAdjustment: number;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [runNumber, setRunNumber] = useState(24);
  const [lastRun, setLastRun] = useState({
    time: "Jun 15, 2026 07:42",
    basinName: basin.name,
    waterYear,
    demandAdjustment,
    lossAdjustment,
    margin: scenario.margin,
    status: scenario.status,
  });

  useEffect(() => {
    setLastRun({
      time: "Jun 15, 2026 07:42",
      basinName: basin.name,
      waterYear,
      demandAdjustment,
      lossAdjustment,
      margin: scenario.margin,
      status: scenario.status,
    });
  }, [basin.id]);

  const conservationMargin = scenario.margin + scenario.adjustedDemand * 0.06;
  const conservationStatus = statusFromMargin(conservationMargin);

  function runModel() {
    setIsRunning(true);
    window.setTimeout(() => {
      setRunNumber((current) => current + 1);
      setLastRun({
        time: "Jun 15, 2026 08:10",
        basinName: basin.name,
        waterYear,
        demandAdjustment,
        lossAdjustment,
        margin: scenario.margin,
        status: scenario.status,
      });
      setIsRunning(false);
    }, 650);
  }

  return (
    <section className="model-run-card">
      <div className="model-run-card__header">
        <div>
          <span className="model-run-card__eyebrow">Backend model</span>
          <h2>Run Forecast Scenario</h2>
        </div>
        <button className="btn btn-primary model-run-card__button" type="button" onClick={runModel} disabled={isRunning}>
          {isRunning ? <RefreshCw size={17} className="model-run-card__spin" /> : <Play size={17} />}
          {isRunning ? "Running" : "Run model"}
        </button>
      </div>

      <div className="model-run-grid">
        <div className="model-run-status">
          <StatusPill status={lastRun.status} />
          <strong>Run {runNumber}: {lastRun.basinName}</strong>
          <span>{lastRun.time}</span>
          <small>Model v0.3 / FIIP daily operations mode</small>
        </div>

        <div className="model-run-assumptions" aria-label="Model assumptions">
          <span>Water year <strong>{lastRun.waterYear}</strong></span>
          <span>Demand <strong>{lastRun.demandAdjustment > 0 ? "+" : ""}{lastRun.demandAdjustment}%</strong></span>
          <span>Loss delta <strong>{lastRun.lossAdjustment > 0 ? "+" : ""}{lastRun.lossAdjustment}%</strong></span>
          <span>Inputs <strong>Current</strong></span>
        </div>

        <div className="scenario-compare">
          <div>
            <span>Current plan</span>
            <strong>{formatAf(lastRun.margin)}</strong>
            <StatusPill status={lastRun.status} />
          </div>
          <div>
            <span>6% demand reduction</span>
            <strong>{formatAf(conservationMargin)}</strong>
            <StatusPill status={conservationStatus} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CriteriaTable({ basin }: { basin: Basin }) {
  return (
    <section className="card h-100">
      <div className="card-header d-flex align-items-center gap-2">
        <Gauge size={18} />
        Compact Criteria Check
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Location</th>
              <th>Current</th>
              <th>MEF</th>
              <th>TIF</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {basin.flowPoints.map((point) => {
              const status: Status = point.currentCfs < point.mefCfs ? "critical" : point.currentCfs < point.tifCfs ? "watch" : "ok";
              return (
                <tr key={point.name}>
                  <td>{point.name}</td>
                  <td>{point.currentCfs} cfs</td>
                  <td>{point.mefCfs} cfs</td>
                  <td>{point.tifCfs} cfs</td>
                  <td>
                    <StatusPill status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReservoirPanel({ basin }: { basin: Basin }) {
  return (
    <section className="card h-100">
      <div className="card-header d-flex align-items-center gap-2">
        <Droplets size={18} />
        Reservoir Storage
      </div>
      <div className="card-body">
        {basin.reservoirs.map((reservoir) => {
          const pct = (reservoir.storageAf / reservoir.capacityAf) * 100;
          const poolPct = (reservoir.minPoolAf / reservoir.capacityAf) * 100;
          const status: Status = reservoir.storageAf < reservoir.minPoolAf * 1.15 ? "warning" : "ok";
          return (
            <div className="reservoir-row" key={reservoir.name}>
              <div className="d-flex justify-content-between gap-3">
                <strong>{reservoir.name}</strong>
                <span>{formatAf(reservoir.storageAf)}</span>
              </div>
              <div className="reservoir-row__track">
                <span className={`reservoir-row__fill reservoir-row__fill--${status}`} style={{ width: `${pct}%` }} />
                <span className="reservoir-row__min" style={{ left: `${poolPct}%` }} title={`Minimum pool ${formatAf(reservoir.minPoolAf)}`} />
              </div>
              <small>Minimum pool: {formatAf(reservoir.minPoolAf)}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActionQueuePanel({ basin, status }: { basin: Basin; status: Status }) {
  return (
    <section className="card">
      <div className="card-header d-flex align-items-center gap-2">
        <ClipboardList size={18} />
        Operational Action Queue
      </div>
      <div className="card-body action-list">
        <div className={`action-item action-item--${status}`}>
          <div>
            <strong>Recommended next move</strong>
            <span>{statusLabel(status)}</span>
          </div>
          <p>{basin.actions[0]}</p>
        </div>
        {basin.actions.slice(1).map((action, index) => (
          <div className="action-item" key={action}>
            <div>
              <strong>Follow-up {index + 1}</strong>
              <span>{index === 0 ? "Monitor" : "Review"}</span>
            </div>
            <p>{action}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [activeId, setActiveId] = useState(basins[0].id);
  const [waterYear, setWaterYear] = useState<WaterYear>("normal");
  const [demandAdjustment, setDemandAdjustment] = useState(0);
  const [lossAdjustment, setLossAdjustment] = useState(0);
  const basin = basins.find((item) => item.id === activeId) ?? basins[0];
  const scenario = useScenario(basin, waterYear, demandAdjustment, lossAdjustment);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container-fluid">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div className="brand-mark">
              <Waves size={28} />
              <div>
                <span>FIIP</span>
                <strong>Water Operations DST</strong>
              </div>
            </div>
            <div className="topbar__meta">
              <CalendarDays size={16} />
              <span>Prototype forecast cycle: Jun 15, 2026</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container-fluid py-3 py-xl-4">
        <section className="hero-band" style={{ backgroundImage: `linear-gradient(90deg, rgba(10, 31, 46, 0.88), rgba(10, 31, 46, 0.42)), url(${basin.image})` }}>
          <div className="hero-band__content">
            <div>
              <p className="eyebrow">CSKT / FIIP operational prototype</p>
              <h1>{basin.name} Decision Workspace</h1>
              <p>
                Integrates supply forecasts, reservoir storage, Compact criteria, conveyance limits, and turnout-scale demand signals into an operator-facing scenario view.
              </p>
            </div>
            <div className="hero-band__status">
              <StatusPill status={scenario.status} />
              <strong>{scenario.recommendation}</strong>
            </div>
          </div>
        </section>

        <BasinTabs activeId={activeId} onSelect={setActiveId} />

        <section className="control-strip">
          <div>
            <label className="form-label" htmlFor="water-year">
              Water year type
            </label>
            <select id="water-year" className="form-select" value={waterYear} onChange={(event) => setWaterYear(event.target.value as WaterYear)}>
              <option value="dry">Dry</option>
              <option value="normal">Normal</option>
              <option value="wet">Wet</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="demand-adjustment">
              Demand adjustment: {demandAdjustment > 0 ? "+" : ""}
              {demandAdjustment}%
            </label>
            <input id="demand-adjustment" className="form-range" type="range" min="-15" max="20" value={demandAdjustment} onChange={(event) => setDemandAdjustment(Number(event.target.value))} />
          </div>
          <div>
            <label className="form-label" htmlFor="loss-adjustment">
              Conveyance loss delta: {lossAdjustment > 0 ? "+" : ""}
              {lossAdjustment}%
            </label>
            <input id="loss-adjustment" className="form-range" type="range" min="-5" max="8" value={lossAdjustment} onChange={(event) => setLossAdjustment(Number(event.target.value))} />
          </div>
        </section>

        <ModelRunPanel
          basin={basin}
          scenario={scenario}
          waterYear={waterYear}
          demandAdjustment={demandAdjustment}
          lossAdjustment={lossAdjustment}
        />

        <section className="row g-3 mb-3">
          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard icon={<MountainSnow size={22} />} label="SNOTEL SWE" value={`${basin.swePercent}%`} detail="Basin index of median" />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard icon={<Droplets size={22} />} label="Supply Margin" value={formatAf(scenario.margin)} detail="Forecast less demand and losses" />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard icon={<Layers size={22} />} label="RDA Remaining" value={formatAf(scenario.rdaRemaining)} detail="Seasonal allowance balance" />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <MetricCard icon={<SlidersHorizontal size={22} />} label="Weekly ET" value={`${basin.etInchesWeek.toFixed(2)} in`} detail={`${basin.acres.toLocaleString()} acres served`} />
          </div>
        </section>

        <section className="row g-3">
          <div className="col-12 col-xl-8">
            <section className="card h-100">
              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                <span className="d-flex align-items-center gap-2">
                  <Waves size={18} />
                  Scenario Balance
                </span>
                <span className="small text-muted">{basin.canalsMiles} canal miles modeled</span>
              </div>
              <div className="card-body">
                <SupplyDemandBar supply={scenario.adjustedSupply} demand={scenario.adjustedDemand} loss={scenario.conveyanceLoss} />
                <div className="decision-callout mt-3">
                  {scenario.status === "critical" ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                  <div>
                    <strong>{scenario.recommendation}</strong>
                    <p>
                      Trace: {criteria.slice(0, 4).join(", ")} <ArrowRight size={14} /> operator review queue.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div className="col-12 col-xl-4">
            <OperationsMap basin={basin} />
          </div>
        </section>

        <section className="row g-3 mt-0">
          <div className="col-12 col-xl-7">
            <CriteriaTable basin={basin} />
          </div>
          <div className="col-12 col-xl-5">
            <ReservoirPanel basin={basin} />
          </div>
        </section>

        <section className="row g-3 mt-0">
          <div className="col-12 col-xl-7">
            <ActionQueuePanel basin={basin} status={scenario.status} />
          </div>
          <div className="col-12 col-xl-5">
            <section className="card">
              <div className="card-header d-flex align-items-center gap-2">
                <AlertTriangle size={18} />
                Operator Review Notes
              </div>
              <div className="card-body">
                <ul className="review-list">
                  {basin.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                <div className="source-grid">
                  {["CSKT Water Data", "USGS streamflow", "NRCS outlook", "BOR AgriMet"].map((source) => (
                    <span key={source}>{source}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
