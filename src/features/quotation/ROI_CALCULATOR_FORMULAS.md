# Solar System Sizing Calculator — Formula Reference & Verification

Source: `System sizing calculator.xlsx` — Matterless Technologies OPC Pvt Ltd  
Scope: Residential sheets only — ROI, Quotation, On-grid Sizing.

---

## Sheet Index

| Sheet | Purpose |
|-------|---------|
| [Return of investment](#1-return-of-investment-residential-6-kw) | Residential ROI & 20-year projection |
| [Quotation](#2-quotation-residential-bill-of-materials) | Residential BoM & pricing |
| [On-grid System sizing calculato](#3-on-grid-system-sizing-calculator-residential) | Residential load & panel sizing |

---

## 1. Return of Investment (Residential 6 kW)

### 1.1 System Costs

| Field | Formula | Value |
|-------|---------|-------|
| System cost | Input | ₹3,80,432.18 |
| Subsidy (PM Surya Ghar) | Input | ₹78,000 |
| Inverter cost | Input | ₹54,799.92 |
| Net investment (DCR panels) | `System cost − Subsidy` | ₹3,02,432.18 |
| **Net investment (non-DCR panels)** | `System cost − Subsidy − 4,752.86` | **₹2,97,679.32** |

> **Why two net investment figures?** The Quotation sheet offers two panel options — Adani DCR (₹26/Wp) and Renesys non-DCR (₹17/Wp). The non-DCR path saves ₹4,752.86 in panel cost, giving the lower net investment. The ROI sheet uses the non-DCR figure. This resolves the apparent ₹4,753 discrepancy. See [Section 2.3](#23-net-investment-after-subsidy).

### 1.2 Generation Profile

| Field | Formula | Value | Verified |
|-------|---------|-------|---------|
| Daily generation | `System kW × Peak sun hours` | 25.9 kWh | ✓ (4.32 PSH — correct for Coimbatore) |
| Annual generation | `Daily generation × 365` | 9,453.5 kWh | ✓ |
| Bi-monthly generation | `Annual generation ÷ 6` | 1,575.58 kWh | ✓ |

The system is sized so bi-monthly generation ≈ bi-monthly consumption (1,575.58 kWh), meaning solar covers the full bill.

### 1.3 TANGEDCO Tariff — Bi-monthly Bill Calculation

Consumption: **1,575.58 kWh** bi-monthly → falls in **>500 kWh slab**.

**Formula:** `Bill = Σ (units_in_slab × slab_rate)`

| Slab (units) | Rate (₹/unit) | Units | Slab cost |
|-------------|--------------|-------|-----------|
| 0 – 100 | ₹0.00 | 100 | ₹0 |
| 101 – 400 | ₹4.70 | 300 | ₹1,410 |
| 401 – 500 | ₹6.30 | 100 | ₹630 |
| 501 – 600 | ₹8.40 | 100 | ₹840 |
| 601 – 800 | ₹9.45 | 200 | ₹1,890 |
| 801 – 1,000 | ₹10.50 | 200 | ₹2,100 |
| 1,001+ | ₹11.55 | 575.58 | ₹6,647.99 |
| **Total** | | **1,575.58** | **₹13,517.99** ✓ |

Derived metrics (shown in sheet):
- `Average rate (slab cost/kW) = 13,517.99 ÷ 1,575.58 = ₹8.58/unit`
- The sheet also models a **<500 kWh scenario** (486.67 units → ₹1,175, avg ₹3.34/unit) and a **high-usage ~3,248 kWh scenario** (₹32,840, avg ₹10.11/unit) for comparison.

### 1.4 Savings Summary

| Field | Formula | Value | Verified |
|-------|---------|-------|---------|
| Bi-monthly saving | `= Bi-monthly bill (solar replaces full bill)` | ₹13,518 | ✓ |
| Annual saving (gross) | `Bi-monthly saving × 6` | ₹81,108 | ✓ |

> **Gross vs net saving:** The annual saving of ₹81,108 is a *gross* figure — it assumes zero residual grid bill after going solar. The 20-year projection uses a more accurate *net* saving that accounts for a residual annual bill (~₹8,111/year in Year 1), giving a Year 1 net saving of ₹72,997.

### 1.5 Payback Period

```
Payback (years) = Net investment ÷ Annual gross saving
               = 2,97,679 ÷ 81,108
               = 3.670 years  →  3 years, 8 months
```

> **⚠️ Off by 1 month:** Sheet shows **"3 years 9 months"** but `0.670 × 12 = 8.04 months`. Minor ceiling rounding error.

The "IF NOT SOLAR" section shows an alternative payback using Year 1 net saving (₹72,997):
```
2,97,679 ÷ 72,997 = 4.08 years
```
> **⚠️ "IF NOT SOLAR" payback discrepancy:** Shows `3.96 years = "3 years 12 months"`. The formula gives 4.08 years. Additionally, "3 years 12 months" is logically "4 years 0 months" — the months formula has an off-by-one error.

### 1.6 Return on Investment

```
ROI (% p.a.) = (Annual gross saving ÷ Net investment) × 100
             = (81,108 ÷ 2,97,679) × 100
             = 27.25%  →  shown as 27.2%  ✓
```

### 1.7 Tariff Escalation — Inconsistency

> **⚠️ Two different escalation rates in the same sheet:**
> - **Summary section** label: `Tariff Escalation = 3%`
> - **20-year projection table** actual growth: **2.00% per year** (verified — every year grows at exactly 2.00%)
>
> The projection numbers are built on 2%. The 3% label is either a stale input or refers to a different scenario. **Clarify before customer presentation.**

### 1.8 20-Year Financial Projection

#### Formulas

```
Bill_without_solar[yr]    = 81,108 × (1.02)^(yr−1)
Bill_with_solar[yr]       = 8,111  × (1.02)^(yr−1)     [Years 1–12]
                            [accelerates Year 13+ — see §1.9]

Annual_saving[yr]         = Bill_without_solar[yr] − Bill_with_solar[yr]

Cumulative_without_solar[yr] = Σ Bill_without_solar[1..yr]

Cumulative_with_solar[yr]    = Net_investment
                               + Σ Bill_with_solar[1..yr]
                               + ₹54,800 inverter replacement (added in Year 11)

Break_even[yr]            = Cumulative_without_solar[yr] − Cumulative_with_solar[yr]
                            (positive = investment fully recovered)
```

#### Projection Table

| Year | Bill w/o solar | Bill w/ solar | Net saving | Cum w/o solar | Cum solar cost | Break-even |
|------|---------------|--------------|-----------|--------------|---------------|------------|
| 1 | ₹81,108 | ₹8,111 | ₹72,997 | ₹81,108 | ₹3,05,790 | −₹2,24,682 |
| 2 | ₹82,730 | ₹8,273 | ₹74,457 | ₹1,63,838 | ₹3,14,063 | −₹1,50,225 |
| 3 | ₹84,385 | ₹8,438 | ₹75,946 | ₹2,48,223 | ₹3,22,502 | −₹74,279 |
| **4** | **₹86,072** | **₹8,607** | **₹77,465** | **₹3,34,295** | **₹3,31,109** | **+₹3,186 ✓ Break-even** |
| 5 | ₹87,794 | ₹8,779 | ₹79,014 | ₹4,22,089 | ₹3,39,888 | +₹82,201 |
| 10 | ₹96,931 | ₹9,693 | ₹87,238 | ₹8,88,109 | ₹3,86,490 | +₹5,01,619 |
| **11** | ₹98,870 | ₹9,887 | ₹88,983 | ₹9,86,979 | **₹4,51,177** | +₹5,35,802 |
| 20 | ₹1,18,159 | ₹21,269 | ₹96,890 | ₹19,70,709 | ₹5,90,197 | +₹13,80,512 |

**Break-even occurs in Year 4.**

#### Year 11 Inverter Replacement

```
Cumulative_with_solar[11] = Cumulative[10] + Bill_with_solar[11] + Inverter_cost
                           = 3,86,490 + 9,887 + 54,800
                           = 4,51,177  ✓
```

#### 29.95% Efficiency Ratio

```
29.95% = Cumulative solar cost (Year 20) ÷ Total 20-yr bill without solar
       = 5,90,197 ÷ 19,70,709 = 29.94%  ✓
```
Going solar costs only **29.95%** of what you'd have paid without it over 20 years.

### 1.9 Panel Degradation (Year 13+)

From Year 13 the solar bill grows faster than 2%, because reduced panel output requires more grid import:

| Period | Solar bill growth | Cause |
|--------|-----------------|-------|
| Years 1–12 | 2.0%/yr | Tariff escalation only |
| Years 13–20 | 8–12%/yr (tapering) | Tariff escalation + panel efficiency loss |

The degradation is implicit — no named formula or rate is documented in the sheet. Standard panels degrade ~0.5%/year; the sheet applies it conservatively starting after Year 12.

### 1.10 Rental / Tenant Model

| Input | Value |
|-------|-------|
| Rate charged to tenant | ₹8/unit |
| Annual tenant consumption | 19,487 units |
| Estimated tenant annual bill | ₹1,55,892 |
| Owner's residual annual bill | ₹8,111 |

```
Rental payback (shown) = 1.3 years
Rental payback (calc)  = 2,97,679 ÷ 1,55,892 = 1.91 years
```

> **⚠️ Rental model broken:** 1.3 years cannot be reproduced. The `#DIV/0!` and `#REF!` errors in the break-even column confirm formulas are incomplete. **Do not use for customer quotes until fixed.**

---

## 2. Quotation (Residential Bill of Materials)

### 2.1 Pricing Formulas

```
BoM Cost    = Qty × Price per unit
Basic Cost  = BoM Cost + Margin
Final Cost  = Basic Cost × (1 + GST%)
```

GST rates: **5%** on solar panels and inverters; **18%** on electrical components (DCDB, ACDB, mounting, wiring, installation).

### 2.2 Component BoM (6 kW Residential)

| Brand | Item | Spec | Qty | Unit Price | BoM Cost | Margin | Basic Cost | GST | Final Cost |
|-------|------|------|-----|-----------|---------|--------|-----------|-----|-----------|
| Adani | Panels TOPCon DCR *(Option A)* | 615 Wp | 11 | ₹26/Wp | ₹1,75,890 | 20% | ₹2,11,068 | 5% | ₹2,21,621 |
| Renesys | Panels TOPCon non-DCR *(Option B)* | 615 Wp | 11 | ₹17/Wp | ₹1,15,005 | 15% | ₹1,32,256 | 5% | ₹1,38,869 |
| Deye | Inverter On-Grid | 12kW 3-phase | 1 | ₹43,492 | ₹43,492 | 20% | ₹52,190 | 5% | ₹54,800 |
| — | DCDB | — | 1 | ₹4,950 | ₹4,950 | 20% | ₹5,940 | 18% | ₹7,009 |
| — | ACDB | — | 1 | ₹4,250 | ₹4,250 | 20% | ₹5,100 | 18% | ₹6,018 |
| — | Mounting structure | — | LS | ₹4,000/unit | ₹24,000 | 20% | ₹28,800 | 18% | ₹33,984 |
| — | Earthing rod | 2m | 3 | ₹3,500 | ₹3,500 | 20% | ₹4,200 | 18% | ₹4,956 |
| — | Lightning arrestor | 1m | 1 | — | ₹0 | — | ₹0 | 18% | ₹0 |
| — | MC4 connectors | — | 12 | ₹42 | ₹504 | 20% | ₹605 | 18% | ₹714 |
| — | Pins & accessories | LS | — | — | ₹4,000 | 25% | ₹5,000 | 18% | ₹5,900 |
| — | Design / Install / Logistics | LS | — | ₹3,000/unit | ₹18,000 | 25% | ₹22,500 | 18% | ₹26,550 |
| 360watts | IoT hub | — | 1 | ₹5,000 | ₹5,000 | 100% | ₹10,000 | 18% | ₹11,800 |
| — | Wiring | — | — | — | ₹5,000 | 20% | ₹6,000 | 18% | ₹7,080 |
| **Total** | | | | | | | | | **₹3,80,432** |

> **⚠️ Lightning arrestor priced at ₹0** — either not supplied or price was not entered. Should be clarified on every quote.

### 2.3 Net Investment After Subsidy

| Panel path | Gross total | Subsidy | Net investment | ₹/kW |
|-----------|------------|---------|---------------|------|
| DCR (Adani) | ₹3,80,432 | ₹78,000 | ₹3,02,432 | ₹50,405 |
| **non-DCR (Renesys)** | ₹3,80,432 | ₹78,000 + ₹4,753 adj | **₹2,97,679** | **₹49,613** |

The ₹4,752.86 adjustment is documented in the sheet as "ADDITIONAL COST: Difference" — the cost saving from choosing non-DCR panels propagates into the net investment. The ROI sheet (Section 1) uses the non-DCR figure.

### 2.4 Issued Customer Quotations (Shakthi Electricals, Avinashi)

Five quotations are embedded in the same sheet:

| Date | System size | Panels | Total (incl. GST) | Notes |
|------|-------------|--------|------------------|-------|
| 14.03.2026 | 5 kW, 1-phase | 9 × Adani 615Wp | ₹2,84,580 | Complete |
| 14.03.2026 | ~10 kW, 3-phase | 16 × TOPCon 615Wp | ₹5,50,082 | Complete |
| 23.03.2026 | ~2 kW | 3 × TOPCon 615Wp | ₹1,07,033 | Complete |
| 23.03.2026 | ~2.5 kW | 4 × TOPCon 615Wp | ₹1,21,950 | Complete |
| 08.04.2026 | ~11 kW, 1-phase | 16 × Waaree 700Wp or 18 × Adani 625Wp | ₹2,71,148 | ⚠️ Incomplete — mounting, accessories, installation missing |

---

## 3. On-Grid System Sizing Calculator (Residential)

### 3.1 Purpose

Sizes a rooftop system from a customer's actual monthly EB bills and future plans (EV, expansion). Customer context: Shakthi Electricals, Avinashi — billing tenants at ₹8/unit.

### 3.2 System Parameters

| Parameter | Value |
|-----------|-------|
| Average peak sun hours | 4.5 hrs |
| Total system losses | 25% |
| Derate factor | 0% |
| Performance ratio | 1.0 |

### 3.3 Actual Monthly Consumption (2025-26)

| Month | kWh | Bill (₹) | Avg ₹/kWh |
|-------|-----|---------|----------|
| May 2026 | 3,378 | ₹29,650 | — |
| March 2026 | 3,069 | ₹26,090 | ₹8.50 |
| January 2026 | 2,341 | ₹17,799 | ₹7.60 |
| November 2025 | 5,336 | ₹52,389 | ₹9.82 |
| October 2025 | 2,806 | ₹20,392 | ₹7.27 |
| May 2025 | 2,557 | ₹20,219 | — |
| **Annual total** | **~19,487** | **~₹1,66,540** | **~₹8.55** |

> **⚠️ November outlier:** 5,336 kWh vs ~2,500–3,400 kWh all other months. Verify the meter reading — this could be a bi-monthly reading entered as monthly, or a genuine consumption spike.

Daily consumption: `19,487 ÷ 365 = 53.4 kWh/day` — this is a large premises (apartment block or small commercial), not a single household.

### 3.4 System Sizing Formulas

```
Energy needed (AC, kWh)         = Daily consumption
Desired AC output (kW)          = Energy needed ÷ PSH
Power Factor                    = 1.0 (residential)
Required AC output (kVA)        = Desired kW ÷ PF
Corresponding DC sizing (kW)    = Required kVA × DC/AC ratio (1.25)
```

Panel configurations evaluated for this customer:

| Scenario | Panels | Wp | DC size (kW) | Inverter (kW) | DC/AC ratio |
|----------|--------|----|-------------|--------------|------------|
| Minimal only | 3 | 620 | 1.86 | 12.0 | 0.155 ⚠️ very low |
| With future expansion | 7 | 610 | 4.27 | 8.0 | 0.534 |
| Full (current + EV) | 11 | 615 | 6.77 | 6.0 | 1.177 ✓ |

> The 3-panel minimal scenario has a DC/AC ratio of 0.155 — far below the recommended 1.0–1.25. It's undersized and would produce very little relative to the inverter capacity. The 11-panel (with EV) option is the correctly sized solution.

### 3.5 EV Charging Load Calculation

| EV | Battery capacity | Full charges/week | Extra kWh/day |
|----|-----------------|-----------------|--------------|
| TATA Nexon | 45 kWh | 3× | 17.36 kWh |
| (2nd EV planned) | 0 kWh | 4× | 0 |

```
Extra power needed/day = (Battery × full_charges_per_week
                          + Battery × 0.5 × half_charges_per_week) ÷ 7
```

Total daily need with EV: `53.4 + 17.4 = 70.8 kWh/day` → drives the 11-panel recommendation.

### 3.6 Panel Output Degradation Over Time

| Panel age | Output w/o EV (kW) | Output with EV (kW) |
|-----------|-------------------|-------------------|
| 10 years | 1.80 | 3.67 |
| 15 years | 1.75 | 3.58 |
| 20 years | 1.71 | 3.49 |

Degradation rate: ~0.25%/year implied (industry standard is ~0.5%/year — this projection is optimistic).

---

## Summary of Errors & Issues (These 3 Sheets)

| # | Sheet | Issue | Severity |
|---|-------|-------|---------|
| 1 | Return of investment | Tariff escalation label says 3% but projection uses 2% | 🔴 High |
| 2 | Return of investment | Payback shows "3 yr 9 mo" — formula gives "3 yr 8 mo" | 🟡 Minor |
| 3 | Return of investment | "IF NOT SOLAR" payback shows "3 yr 12 mo" (= 4 yr 0 mo) — also numerically wrong at 3.96 vs 4.08 | 🟡 Minor |
| 4 | Return of investment | Rental model has `#DIV/0!` and `#REF!` errors; 1.3-yr payback not reproducible | 🔴 High |
| 5 | Return of investment | Degradation model is implicit — no documented rate or start year | 🟡 Medium |
| 6 | Quotation | Lightning arrestor priced at ₹0 on all quotes | 🟡 Medium |
| 7 | Quotation | 08.04.2026 quote missing mounting, accessories, installation — total understated | 🔴 High |
| 8 | On-grid sizing | November 2025 reads 5,336 kWh vs ~3,000 kWh all other months — likely data entry error | 🟡 Medium |
| 9 | On-grid sizing | 3-panel minimal config has DC/AC ratio 0.155 — impractical, should be flagged | 🟡 Medium |
| 10 | On-grid sizing | Degradation rate ~0.25%/yr used vs industry standard ~0.5%/yr — projections are optimistic | 🟡 Medium |

---

## Quick-Reference Formula Cheatsheet

```
# Generation
Daily gen (kWh)    = System kW × Peak sun hours
Annual gen         = Daily gen × 365
Bi-monthly gen     = Annual gen ÷ 6

# TANGEDCO tariff (progressive slabs)
Bi-monthly bill    = Σ (units_in_slab × slab_rate)

# ROI
Net investment     = System cost − Subsidy  [DCR path]
                   = System cost − Subsidy − panel_saving  [non-DCR path]
Annual saving      = Bi-monthly bill × 6
Payback (years)    = Net investment ÷ Annual saving
ROI % p.a.         = Annual saving ÷ Net investment × 100

# 20-year projection
Bill[yr]           = Bill[1] × (1.02)^(yr−1)           [2% tariff escalation]
Cum_solar[yr]      = Net_investment + Σ solar_bills[1..yr] + 54,800 (inverter, Year 11)
Break_even[yr]     = Cum_no_solar[yr] − Cum_solar[yr]   [positive = payback achieved]
29.95% ratio       = Cum_solar[yr20] ÷ Cum_no_solar[yr20]

# Quotation BoM
BoM Cost           = Qty × Unit price
Basic Cost         = BoM Cost × (1 + margin%)
Final Cost         = Basic Cost × (1 + GST%)            [5% solar, 18% electrical]

# System sizing
DC size (kW)       = Daily consumption ÷ (PSH × PF) × DC/AC ratio × (1 + losses%)
EV extra load/day  = (Battery × full_pw + Battery × 0.5 × half_pw) ÷ 7
```
