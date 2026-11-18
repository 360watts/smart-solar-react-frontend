# Phase comparison: inverter column

Bug (2026-11-18): the Total Load popup's Inverter column was always "—" on the desktop Overview tab because `OverviewTab` never forwarded `inverterPhasesForFlow` to `EnergyFlowHealthRow` → `EnergyFlowBlock`.

| # | Given | When | Then | Type | Pri | Status |
|---|-------|------|------|------|-----|--------|
| P1 | Overview tab, latest row has load_l*/grid_l* fields | Open Load node popup | Inverter column shows power, voltage, current per phase, PF and frequency | live | P1 | planned |
| P2 | Latest row stale (gateway offline) | Open popup | Last known inverter values still shown (falls back to newest telemetry row) | live | P2 | planned |
| P3 | No telemetry at all | Open popup | Inverter column "—", meter column unaffected | live | P3 | planned |
| P4 | Analytics Energy Flow Snapshot | Open Load popup | Still "—" (not wired, known gap) | live | P3 | planned |
| P5 | Overview, Load popup | Look at Power Factor row | Inverter side shows "—" (register 621 reads ~0.01 while exporting kW, not a real PF); meter side unchanged; footnote says inverter PF is not measured | live | P2 | planned |

Live check: coim_002 Overview → Load node → Inverter column populated.
