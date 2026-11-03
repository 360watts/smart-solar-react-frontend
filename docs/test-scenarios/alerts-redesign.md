# Alerts page redesign (Triage / Fleet health / Analytics)

| # | Given | When | Then | Type | Pri | Status |
|---|-------|------|------|------|-----|--------|
| A1 | Open incidents exist | Page opens | Triage lists them worst-first with site name and AI cause/fix in the side panel | integration | P0 | passing |
| A2 | An open incident | Acknowledge / Mark resolved | Row updates from the API response | integration | P0 | planned |
| A3 | Fleet report with a critical alert | Fleet health tab | Verdict "Needs attention", issues listed, sites worst-first | integration | P1 | passing |
| A4 | Report for a day | Previous / next day | Loads that date; next is disabled on the latest | integration | P2 | planned |
| A5 | Analytics data | Analytics tab, range chips | Chart, ranked list, rule reason and fix guidance | integration | P1 | passing |
| A6 | Mobile width | Page opens | Old MobileAlerts is shown | integration | P2 | planned |

Backend: `GET /incidents/fleet/` rows carry `site_id`, `site_name`, `diagnostic` (tests in `tests/test_incidents_api.py`, `FleetIncidentsRowTests`).

Live verification: deploy backend first, then open /alerts on a day with open incidents and check all three tabs.
