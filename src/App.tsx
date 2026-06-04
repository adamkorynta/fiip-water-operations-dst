import { ReactNode, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Database,
  Droplets,
  FileText,
  Gauge,
  History,
  Layers,
  LayoutDashboard,
  Map as MapIcon,
  MountainSnow,
  Play,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { Basin, BasinId, OperationPin, Status, WaterYear, basins, criteria } from "./data";

const statusRank: Record<Status, number> = { ok: 0, watch: 1, warning: 2, critical: 3 };
type RunScope = "fiip-wide" | "single-area";
type RunScopeValue = "fiip-wide" | BasinId;
type ViewTab = "dashboard" | "model-run";

interface ScenarioInput {
  forecastAf: number;
  demandAf: number;
  rdaAf: number;
  conveyanceLossPercent: number;
  flowPoints: Basin["flowPoints"];
  reservoirs: Basin["reservoirs"];
}

interface PortalFeed {
  name: string;
  lastUpdated: string;
  cadence: string;
  status: Status;
}

interface PortalAlert {
  name: string;
  message: string;
  triggered: string;
  status: Status;
}

interface RunRecord {
  runId: string;
  time: string;
  scope: RunScope;
  scopeLabel: string;
  basinName: string;
  waterYear: WaterYear;
  demandAdjustment: number;
  lossAdjustment: number;
  snapshot: "latest" | "pinned";
  margin: number;
  status: Status;
}

const portalFeedByBasin: Record<BasinId, PortalFeed[]> = {
  "mission-south": [
    { name: "Mission Creek below Pablo Feeder", lastUpdated: "2026-06-03 21:38", cadence: "15 min", status: "ok" },
    { name: "Pablo Reservoir elevation", lastUpdated: "2026-06-03 20:05", cadence: "hourly", status: "watch" },
    { name: "Crow Creek diversion flow", lastUpdated: "2026-06-03 21:15", cadence: "15 min", status: "warning" },
  ],
  "mission-north": [
    { name: "Post Creek below F Canal", lastUpdated: "2026-06-03 20:30", cadence: "15 min", status: "ok" },
    { name: "McDonald Reservoir level", lastUpdated: "2026-06-03 19:50", cadence: "hourly", status: "watch" },
    { name: "North Crow Creek station", lastUpdated: "2026-06-03 21:20", cadence: "15 min", status: "ok" },
  ],
  jocko: [
    { name: "Jocko River below Lower J Canal", lastUpdated: "2026-06-03 21:15", cadence: "15 min", status: "critical" },
    { name: "Tabor Reservoir elevation", lastUpdated: "2026-06-03 19:10", cadence: "hourly", status: "warning" },
    { name: "Jocko K Canal diversion", lastUpdated: "2026-06-03 21:30", cadence: "15 min", status: "critical" },
  ],
  "little-bitterroot": [
    { name: "Little Bitterroot above Mill Creek", lastUpdated: "2026-06-03 21:15", cadence: "15 min", status: "ok" },
    { name: "Hubbart Reservoir level", lastUpdated: "2026-06-03 20:10", cadence: "hourly", status: "watch" },
    { name: "Hot Springs Creek confluence", lastUpdated: "2026-06-03 20:55", cadence: "15 min", status: "watch" },
  ],
};

const portalAlertsByBasin: Record<BasinId, PortalAlert[]> = {
  "mission-south": [
    { name: "IMEF Flow Violation", message: "Crow Creek below Moiese A Canal below threshold; diversion staging advised.", triggered: "2026-06-03 19:32", status: "warning" },
    { name: "Peak Discharge Alert", message: "Mission Creek pulse event detected; verify turnout response window.", triggered: "2026-06-03 13:44", status: "watch" },
    { name: "Reservoir Minimum Pool", message: "Pablo Reservoir near minimum-pool advisory buffer.", triggered: "2026-06-03 06:55", status: "watch" },
  ],
  "mission-north": [
    { name: "IMEF Flow Violation", message: "Post Creek below F Canal entered watch band within 20% of limit.", triggered: "2026-06-03 14:21", status: "watch" },
    { name: "Peak Discharge Alert", message: "North Crow Creek increase observed; confirm gate setting trajectory.", triggered: "2026-06-03 09:05", status: "watch" },
    { name: "Dataset Update Delay", message: "Mission Reservoir level feed lagged beyond expected hourly cadence.", triggered: "2026-06-03 05:42", status: "warning" },
  ],
  jocko: [
    { name: "IMEF Flow Violation", message: "Jocko River below Lower J Canal remains below MEF criterion.", triggered: "2026-06-03 21:15", status: "critical" },
    { name: "Peak Discharge Alert", message: "Jocko River at mouth peak discharge event; field verification queued.", triggered: "2026-06-03 19:32", status: "warning" },
    { name: "Reservoir Minimum Pool", message: "Tabor Reservoir crossing minimum-pool working band.", triggered: "2026-06-03 08:40", status: "warning" },
  ],
  "little-bitterroot": [
    { name: "IMEF Flow Violation", message: "Hot Springs Creek entered watch band, within 20% of ISF threshold.", triggered: "2026-06-03 16:08", status: "watch" },
    { name: "Peak Discharge Alert", message: "Little Bitterroot short pulse event cleared after 30-minute window.", triggered: "2026-06-03 10:32", status: "ok" },
    { name: "Reservoir Minimum Pool", message: "Hubbart Reservoir remains above minimum-pool floor.", triggered: "2026-06-03 07:19", status: "ok" },
  ],
};

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

function calculateScenario(input: ScenarioInput, waterYear: WaterYear, demandAdjustment: number, lossAdjustment: number) {
  const yearFactor = waterYear === "dry" ? 0.82 : waterYear === "wet" ? 1.18 : 1;
  const adjustedSupply = input.forecastAf * yearFactor;
  const adjustedDemand = input.demandAf * (1 + demandAdjustment / 100);
  const conveyanceLoss = adjustedDemand * ((input.conveyanceLossPercent + lossAdjustment) / 100);
  const deliveryNeed = adjustedDemand + conveyanceLoss;
  const margin = adjustedSupply - deliveryNeed;
  const rdaUse = Math.min(deliveryNeed, input.rdaAf * 1.08);
  const rdaRemaining = input.rdaAf - rdaUse;
  const flowDeficits = input.flowPoints.filter((point) => point.currentCfs < point.mefCfs);
  const reservoirDeficits = input.reservoirs.filter((reservoir) => reservoir.storageAf < reservoir.minPoolAf * 1.15);
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
}

function useScenario(input: ScenarioInput, waterYear: WaterYear, demandAdjustment: number, lossAdjustment: number) {
  return useMemo(() => {
    return calculateScenario(input, waterYear, demandAdjustment, lossAdjustment);
  }, [input, waterYear, demandAdjustment, lossAdjustment]);
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
    // Leaflet can mis-measure width during dynamic layout changes; force a recompute.
    const refreshSize = () => map.invalidateSize({ animate: false });
    const timer = window.setTimeout(refreshSize, 80);
    window.addEventListener("resize", refreshSize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", refreshSize);
    };
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

function ModelInputsPanel({
  runScopeValue,
  setRunScopeValue,
  waterYear,
  setWaterYear,
  demandAdjustment,
  setDemandAdjustment,
  lossAdjustment,
  setLossAdjustment,
  dataSnapshot,
  setDataSnapshot,
}: {
  runScopeValue: RunScopeValue;
  setRunScopeValue: (value: RunScopeValue) => void;
  waterYear: WaterYear;
  setWaterYear: (value: WaterYear) => void;
  demandAdjustment: number;
  setDemandAdjustment: (value: number) => void;
  lossAdjustment: number;
  setLossAdjustment: (value: number) => void;
  dataSnapshot: "latest" | "pinned";
  setDataSnapshot: (value: "latest" | "pinned") => void;
}) {
  return (
    <section className="model-panel model-panel--inputs">
      <div className="model-panel__header">
        <SlidersHorizontal size={17} />
        <div>
          <span>Model inputs</span>
          <strong>Decision and data settings</strong>
        </div>
      </div>
      <div className="model-input-grid">
        <div>
          <label className="form-label" htmlFor="run-scope">
            Run scope
          </label>
          <select id="run-scope" className="form-select" value={runScopeValue} onChange={(event) => setRunScopeValue(event.target.value as RunScopeValue)}>
            <option value="fiip-wide">FIIP-wide (all operating areas)</option>
            {basins.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
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
          <label className="form-label" htmlFor="snapshot-type">
            Data snapshot
          </label>
          <select id="snapshot-type" className="form-select" value={dataSnapshot} onChange={(event) => setDataSnapshot(event.target.value as "latest" | "pinned")}>
            <option value="latest">Latest feed values</option>
            <option value="pinned">Pinned timestamp set</option>
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
      </div>
    </section>
  );
}

function RunReadinessPanel({ readiness }: { readiness: Array<{ label: string; status: Status; detail: string }> }) {
  return (
    <section className="model-panel model-panel--readiness">
      <div className="model-panel__header">
        <ShieldCheck size={17} />
        <div>
          <span>Run readiness</span>
          <strong>Validation gate</strong>
        </div>
      </div>
      <div className="readiness-list">
        {readiness.map((item) => (
          <article key={item.label}>
            <div className="d-flex align-items-center justify-content-between gap-2">
              <strong>{item.label}</strong>
              <StatusPill status={item.status} />
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ModelExecutionPanel({
  scenario,
  baselineMargin,
  baselineStatus,
  isRunning,
  onRun,
  runRecord,
  dataSnapshot,
}: {
  scenario: ReturnType<typeof useScenario>;
  baselineMargin: number;
  baselineStatus: Status;
  isRunning: boolean;
  onRun: () => void;
  runRecord: RunRecord;
  dataSnapshot: "latest" | "pinned";
}) {
  const marginDelta = scenario.margin - baselineMargin;

  return (
    <section className="model-panel model-panel--execute">
      <div className="model-panel__header">
        <Play size={17} />
        <div>
          <span>Execute model</span>
          <strong>Operational run controller</strong>
        </div>
      </div>

      <div className="execute-toolbar">
        <button className="btn btn-primary model-run-card__button" type="button" onClick={onRun} disabled={isRunning}>
          {isRunning ? <RefreshCw size={17} className="model-run-card__spin" /> : <Play size={17} />}
          {isRunning ? "Running" : "Execute operational run"}
        </button>
        <button className="btn btn-outline-secondary" type="button">Save draft scenario</button>
        <button className="btn btn-outline-secondary" type="button">Compare to baseline</button>
      </div>

      <div className="model-run-grid">
        <div className="model-run-status">
          <StatusPill status={runRecord.status} />
          <strong>{runRecord.runId}: {runRecord.scopeLabel}</strong>
          <span>{runRecord.time}</span>
          <small>Model v0.3 / FIIP daily operations mode</small>
        </div>

        <div className="model-run-assumptions" aria-label="Model assumptions">
          <span>Water year <strong>{runRecord.waterYear}</strong></span>
          <span>Scope <strong>{runRecord.scope === "fiip-wide" ? "FIIP-wide" : "Single area"}</strong></span>
          <span>Demand <strong>{runRecord.demandAdjustment > 0 ? "+" : ""}{runRecord.demandAdjustment}%</strong></span>
          <span>Loss delta <strong>{runRecord.lossAdjustment > 0 ? "+" : ""}{runRecord.lossAdjustment}%</strong></span>
          <span>Inputs <strong>{dataSnapshot === "latest" ? "Latest" : "Pinned"}</strong></span>
        </div>

        <div className="scenario-compare">
          <div>
            <span>Current run margin</span>
            <strong>{formatAf(scenario.margin)}</strong>
            <StatusPill status={scenario.status} />
          </div>
          <div>
            <span>Baseline delta</span>
            <strong>{marginDelta > 0 ? "+" : ""}{formatAf(marginDelta)}</strong>
            <StatusPill status={baselineStatus} />
          </div>
        </div>
      </div>

      <div className="execution-footnote">
        <FileText size={15} />
        <span>Run outputs will include compliance summary, recommendation trace, and export-ready decision packet.</span>
      </div>
    </section>
  );
}

function RunAuditTrail({ history }: { history: RunRecord[] }) {
  return (
    <section className="model-panel model-panel--audit">
      <div className="model-panel__header">
        <History size={17} />
        <div>
          <span>Run audit trail</span>
          <strong>Latest execution history</strong>
        </div>
      </div>
      <div className="run-history-list" role="list" aria-label="Model run history">
        {history.map((run) => (
          <article key={run.runId} role="listitem">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <strong>{run.runId}</strong>
              <StatusPill status={run.status} />
            </div>
            <span>{run.time}</span>
            <small>
              {run.scopeLabel} | {run.snapshot === "latest" ? "Latest" : "Pinned"} inputs | Margin {formatAf(run.margin)}
            </small>
          </article>
        ))}
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

function ComplianceSnapshot({
  mefViolations,
  mefWatch,
  tifShortfalls,
  reservoirWatch,
  rdaRisk,
}: {
  mefViolations: number;
  mefWatch: number;
  tifShortfalls: number;
  reservoirWatch: number;
  rdaRisk: Status;
}) {
  return (
    <section className="compliance-strip" aria-label="Compliance status snapshot">
      <article>
        <span>MEF violations</span>
        <strong>{mefViolations}</strong>
        <StatusPill status={mefViolations > 0 ? "critical" : "ok"} />
      </article>
      <article>
        <span>Within 20% band</span>
        <strong>{mefWatch}</strong>
        <StatusPill status={mefWatch > 0 ? "watch" : "ok"} />
      </article>
      <article>
        <span>TIF shortfalls</span>
        <strong>{tifShortfalls}</strong>
        <StatusPill status={tifShortfalls > 0 ? "warning" : "ok"} />
      </article>
      <article>
        <span>Reservoir pool watch</span>
        <strong>{reservoirWatch}</strong>
        <StatusPill status={reservoirWatch > 0 ? "warning" : "ok"} />
      </article>
      <article>
        <span>RDA allowance risk</span>
        <strong>{rdaRisk === "critical" ? "High" : rdaRisk === "warning" ? "Moderate" : "Low"}</strong>
        <StatusPill status={rdaRisk} />
      </article>
    </section>
  );
}

function DataFreshnessPanel({ feeds }: { feeds: PortalFeed[] }) {
  return (
    <section className="card h-100">
      <div className="card-header d-flex align-items-center gap-2">
        <Database size={18} />
        Data Freshness and Source Status
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Last Updated</th>
              <th>Cadence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((feed) => (
              <tr key={feed.name}>
                <td>{feed.name}</td>
                <td>{feed.lastUpdated}</td>
                <td>{feed.cadence}</td>
                <td><StatusPill status={feed.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: PortalAlert[] }) {
  return (
    <section className="card h-100">
      <div className="card-header d-flex align-items-center gap-2">
        <BellRing size={18} />
        Recent Alerts
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Message</th>
              <th>Triggered</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={`${alert.name}-${alert.triggered}`}>
                <td>{alert.name}</td>
                <td>{alert.message}</td>
                <td className="text-nowrap"><Clock3 size={14} className="me-1" />{alert.triggered}</td>
                <td><StatusPill status={alert.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  const [activeId, setActiveId] = useState(basins[0].id);
  const [activeView, setActiveView] = useState<ViewTab>("dashboard");
  const [runScopeValue, setRunScopeValue] = useState<RunScopeValue>("fiip-wide");
  const [waterYear, setWaterYear] = useState<WaterYear>("normal");
  const [demandAdjustment, setDemandAdjustment] = useState(0);
  const [lossAdjustment, setLossAdjustment] = useState(0);
  const [dataSnapshot, setDataSnapshot] = useState<"latest" | "pinned">("latest");
  const [isRunning, setIsRunning] = useState(false);
  const [runSeq, setRunSeq] = useState(24);
  const basin = basins.find((item) => item.id === activeId) ?? basins[0];
  const runScope: RunScope = runScopeValue === "fiip-wide" ? "fiip-wide" : "single-area";
  const runBasin = runScopeValue === "fiip-wide" ? undefined : basins.find((item) => item.id === runScopeValue);
  const scopedBasins = runScopeValue === "fiip-wide" ? basins : runBasin ? [runBasin] : [basin];
  const scopeLabel = runScopeValue === "fiip-wide" ? "FIIP-wide" : (runBasin?.name ?? basin.name);
  const scopedInput = useMemo<ScenarioInput>(() => {
    const forecastAf = scopedBasins.reduce((sum, item) => sum + item.forecastAf, 0);
    const demandAf = scopedBasins.reduce((sum, item) => sum + item.demandAf, 0);
    const rdaAf = scopedBasins.reduce((sum, item) => sum + item.rdaAf, 0);
    const avgLoss = scopedBasins.reduce((sum, item) => sum + item.conveyanceLossPercent, 0) / scopedBasins.length;
    return {
      forecastAf,
      demandAf,
      rdaAf,
      conveyanceLossPercent: avgLoss,
      flowPoints: scopedBasins.flatMap((item) => item.flowPoints),
      reservoirs: scopedBasins.flatMap((item) => item.reservoirs),
    };
  }, [scopedBasins]);

  const scenario = useScenario(scopedInput, waterYear, demandAdjustment, lossAdjustment);
  const baselineScenario = useScenario(scopedInput, waterYear, 0, 0);
  const basinScenario = useScenario(
    {
      forecastAf: basin.forecastAf,
      demandAf: basin.demandAf,
      rdaAf: basin.rdaAf,
      conveyanceLossPercent: basin.conveyanceLossPercent,
      flowPoints: basin.flowPoints,
      reservoirs: basin.reservoirs,
    },
    waterYear,
    demandAdjustment,
    lossAdjustment,
  );
  const feeds = scopedBasins.flatMap((item) => portalFeedByBasin[item.id]);
  const alerts = scopedBasins.flatMap((item) => portalAlertsByBasin[item.id]).slice(0, 8);
  const areaFeeds = portalFeedByBasin[basin.id];
  const areaAlerts = portalAlertsByBasin[basin.id];
  const scopedFlowPoints = scopedBasins.flatMap((item) => item.flowPoints);
  const scopedReservoirs = scopedBasins.flatMap((item) => item.reservoirs);
  const mefViolations = scopedFlowPoints.filter((point) => point.currentCfs < point.mefCfs).length;
  const mefWatch = scopedFlowPoints.filter((point) => point.currentCfs >= point.mefCfs && point.currentCfs < point.mefCfs * 1.2).length;
  const tifShortfalls = scopedFlowPoints.filter((point) => point.currentCfs < point.tifCfs).length;
  const reservoirWatch = scopedReservoirs.filter((reservoir) => reservoir.storageAf < reservoir.minPoolAf * 1.15).length;
  const rdaRisk: Status = scenario.rdaRemaining < -3000 ? "critical" : scenario.rdaRemaining < 0 ? "warning" : scenario.rdaRemaining < 6000 ? "watch" : "ok";
  const basinMefViolations = basin.flowPoints.filter((point) => point.currentCfs < point.mefCfs).length;
  const basinMefWatch = basin.flowPoints.filter((point) => point.currentCfs >= point.mefCfs && point.currentCfs < point.mefCfs * 1.2).length;
  const basinTifShortfalls = basin.flowPoints.filter((point) => point.currentCfs < point.tifCfs).length;
  const basinReservoirWatch = basin.reservoirs.filter((reservoir) => reservoir.storageAf < reservoir.minPoolAf * 1.15).length;
  const basinRdaRisk: Status = basinScenario.rdaRemaining < -3000 ? "critical" : basinScenario.rdaRemaining < 0 ? "warning" : basinScenario.rdaRemaining < 6000 ? "watch" : "ok";
  const feedRisk: Status = feeds.some((item) => item.status === "critical") ? "critical" : feeds.some((item) => item.status === "warning") ? "warning" : feeds.some((item) => item.status === "watch") ? "watch" : "ok";
  const readiness: Array<{ label: string; status: Status; detail: string }> = [
    {
      label: "Input datasets loaded",
      status: feedRisk,
      detail: `${feeds.length} active feeds for ${scopeLabel}; highest risk level is ${statusLabel(feedRisk).toLowerCase()}.`,
    },
    {
      label: "Compact criteria available",
      status: scopedFlowPoints.length > 0 ? "ok" : "warning",
      detail: scopedFlowPoints.length > 0 ? `${scopedFlowPoints.length} stream criteria points loaded.` : "No flow criteria points loaded for this scope.",
    },
    {
      label: "Reservoir constraints available",
      status: scopedReservoirs.length > 0 ? "ok" : "warning",
      detail: scopedReservoirs.length > 0 ? `${scopedReservoirs.length} reservoir minimum-pool constraints loaded.` : "No reservoir constraint set loaded.",
    },
  ];

  const [runHistory, setRunHistory] = useState<RunRecord[]>([
    {
      runId: "FIIP-RUN-024",
      time: "Jun 15, 2026 07:42",
      scope: "fiip-wide",
      scopeLabel: "FIIP-wide",
      basinName: basins[0].name,
      waterYear: "normal",
      demandAdjustment: 0,
      lossAdjustment: 0,
      snapshot: "latest",
      margin: 6400,
      status: "watch",
    },
    {
      runId: "FIIP-RUN-023",
      time: "Jun 14, 2026 16:30",
      scope: "single-area",
      scopeLabel: basins[1].name,
      basinName: basins[1].name,
      waterYear: "normal",
      demandAdjustment: 2,
      lossAdjustment: 1,
      snapshot: "latest",
      margin: 8100,
      status: "ok",
    },
  ]);

  const [lastRun, setLastRun] = useState<RunRecord>({
    runId: "FIIP-RUN-024",
    time: "Jun 15, 2026 07:42",
    scope: runScope,
    scopeLabel,
    basinName: basin.name,
    waterYear,
    demandAdjustment,
    lossAdjustment,
    snapshot: dataSnapshot,
    margin: scenario.margin,
    status: scenario.status,
  });

  useEffect(() => {
    setLastRun((current) => ({
      ...current,
      scope: runScope,
      scopeLabel,
      basinName: runScopeValue === "fiip-wide" ? "All operating areas" : scopeLabel,
      waterYear,
      demandAdjustment,
      lossAdjustment,
      snapshot: dataSnapshot,
      margin: scenario.margin,
      status: scenario.status,
    }));
  }, [runScope, runScopeValue, scopeLabel, waterYear, demandAdjustment, lossAdjustment, dataSnapshot, scenario.margin, scenario.status]);

  function runModel() {
    setIsRunning(true);
    window.setTimeout(() => {
      const nextRun = runSeq + 1;
      const runRecord: RunRecord = {
        runId: `FIIP-RUN-${String(nextRun).padStart(3, "0")}`,
        time: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }),
        scope: runScope,
        scopeLabel,
        basinName: runScopeValue === "fiip-wide" ? "All operating areas" : scopeLabel,
        waterYear,
        demandAdjustment,
        lossAdjustment,
        snapshot: dataSnapshot,
        margin: scenario.margin,
        status: scenario.status,
      };
      setRunSeq(nextRun);
      setLastRun(runRecord);
      setRunHistory((current) => [runRecord, ...current].slice(0, 6));
      setIsRunning(false);
    }, 650);
  }

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
              <h1>{runScope === "fiip-wide" ? "FIIP-wide Decision Workspace" : `${scopeLabel} Decision Workspace`}</h1>
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

        <section className="view-tabs" role="tablist" aria-label="Primary workspaces">
          <button type="button" role="tab" aria-selected={activeView === "dashboard"} className={activeView === "dashboard" ? "active" : ""} onClick={() => setActiveView("dashboard")}>
            <LayoutDashboard size={15} />
            <span>
              <strong>Operations Dashboard</strong>
              <small>Live status, map, alerts, and constraints</small>
            </span>
          </button>
          <button type="button" role="tab" aria-selected={activeView === "model-run"} className={activeView === "model-run" ? "active" : ""} onClick={() => setActiveView("model-run")}>
            <Play size={15} />
            <span>
              <strong>Model Run Workspace</strong>
              <small>Inputs, readiness, execution, and audit</small>
            </span>
          </button>
        </section>

        {activeView === "model-run" ? (
          <>
            <section className="model-run-layout" aria-label="Model run workflow">
              <section className="row g-3 mb-3">
                <div className="col-12 col-xl-4">
                  <ModelInputsPanel
                    runScopeValue={runScopeValue}
                    setRunScopeValue={setRunScopeValue}
                    waterYear={waterYear}
                    setWaterYear={setWaterYear}
                    demandAdjustment={demandAdjustment}
                    setDemandAdjustment={setDemandAdjustment}
                    lossAdjustment={lossAdjustment}
                    setLossAdjustment={setLossAdjustment}
                    dataSnapshot={dataSnapshot}
                    setDataSnapshot={setDataSnapshot}
                  />
                  <RunReadinessPanel readiness={readiness} />
                </div>
                <div className="col-12 col-xl-8">
                    <ModelExecutionPanel
                      scenario={scenario}
                      baselineMargin={baselineScenario.margin}
                      baselineStatus={baselineScenario.status}
                      isRunning={isRunning}
                      onRun={runModel}
                      runRecord={lastRun}
                      dataSnapshot={dataSnapshot}
                    />
                    <div className="mt-3">
                      <RunAuditTrail history={runHistory} />
                    </div>
                </div>
              </section>
            </section>
          </>
        ) : (
          <>
            <BasinTabs activeId={activeId} onSelect={setActiveId} />

            <ComplianceSnapshot
              mefViolations={basinMefViolations}
              mefWatch={basinMefWatch}
              tifShortfalls={basinTifShortfalls}
              reservoirWatch={basinReservoirWatch}
              rdaRisk={basinRdaRisk}
            />

            <section className="row g-3 mb-3">
              <div className="col-12 col-md-6 col-xl-3">
                <MetricCard icon={<MountainSnow size={22} />} label="SNOTEL SWE" value={`${basin.swePercent}%`} detail="Basin index of median" />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <MetricCard icon={<Droplets size={22} />} label="Supply Margin" value={formatAf(basinScenario.margin)} detail="Forecast less demand and losses" />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <MetricCard icon={<Layers size={22} />} label="RDA Remaining" value={formatAf(basinScenario.rdaRemaining)} detail="Seasonal allowance balance" />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <MetricCard icon={<SlidersHorizontal size={22} />} label="Weekly ET" value={`${basin.etInchesWeek.toFixed(2)} in`} detail={`${basin.acres.toLocaleString()} acres served`} />
              </div>
            </section>

            <section className="row g-3">
          <div className="col-12">
            <section className="card h-100">
              <div className="card-header d-flex align-items-center justify-content-between gap-2">
                <span className="d-flex align-items-center gap-2">
                  <Waves size={18} />
                  Scenario Balance
                </span>
                <span className="small text-muted">{basin.canalsMiles} canal miles modeled</span>
              </div>
              <div className="card-body">
                <SupplyDemandBar supply={basinScenario.adjustedSupply} demand={basinScenario.adjustedDemand} loss={basinScenario.conveyanceLoss} />
                <div className="decision-callout mt-3">
                  {basinScenario.status === "critical" ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                  <div>
                    <strong>{basinScenario.recommendation}</strong>
                    <p>
                      Trace: {criteria.slice(0, 4).join(", ")} <ArrowRight size={14} /> operator review queue.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div className="col-12">
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
            <DataFreshnessPanel feeds={areaFeeds} />
          </div>
          <div className="col-12 col-xl-5">
            <AlertsPanel alerts={areaAlerts} />
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
          </>
        )}
      </main>
    </div>
  );
}

export default App;
