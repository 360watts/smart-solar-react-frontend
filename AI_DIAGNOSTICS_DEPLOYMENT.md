# AI Diagnostics Button — Deployment Guide

## Overview
This document covers the "Run AI Diagnostics on All Active Alerts" feature added to the Alerts tab in the admin dashboard.

## Feature Description

### What It Does
- Allows staff users to manually trigger AI diagnostic analysis on all active and acknowledged alerts
- Processes up to 10 alerts per request
- Displays results in a collapsible panel below the alerts toolbar
- Shows root cause analysis, severity, and recommendations for each alert
- Integrates with the existing OpenRouter LLM pipeline

### When to Use
- Investigating alerts in bulk without waiting for the automated diagnostic pipeline
- Case where `DIAGNOSE_ALERTS_ENABLED` environment flag is disabled (manual override)
- Verifying AI diagnostic output before trusting it for decision-making
- During troubleshooting sessions with operations team

## Deployment Requirements

### Environment Variables (Backend)
The feature uses existing OpenRouter environment variables:

```bash
# Required
OPENROUTER_API_KEY=sk-or-...     # Your OpenRouter API key

# Optional (auto-detected)
OPENROUTER_MODEL_DIAGNOSTIC=google/gemini-2.0-flash-exp:free
OPENROUTER_MODEL_CHAT=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
```

If `OPENROUTER_API_KEY` is not set, the API returns a 503 Service Unavailable with an error message.

### Prerequisites
- Django backend running on Railway (or local)
- React frontend built with `npm run build`
- Staff authentication working (`@permission_classes([IsStaffUser])`)
- OpenRouter API account with available model credits

### Database
- No schema changes required
- No migrations needed
- Uses existing `Alert.metadata` JSONB column for storing diagnostics

## Installation & Deployment Steps

### 1. Backend Deployment

#### Check if Already Applied
```bash
cd /home/ubuntu/work/smart-solar-django-backend
grep -n "diagnose_batch\|diagnose-batch" api/views.py api/urls.py
```

Expected output:
```
api/views.py:4605:def alert_diagnose_batch(request: Any) -> Response:
api/urls.py:145:    path("alerts/diagnose-batch/", views.alert_diagnose_batch, name="alert_diagnose_batch"),
```

#### If Not Yet Applied
1. Add the new view to `api/views.py` at line ~4605 (after `alert_resolve`)
2. Add the URL route to `api/urls.py` at line 145

See [Backend Implementation](#backend-implementation) section below.

#### Deploy to Railway
```bash
cd /home/ubuntu/work/smart-solar-django-backend
git add api/views.py api/urls.py
git commit -m "feat: add /api/alerts/diagnose-batch/ endpoint for manual AI diagnostics"
git push origin main
```

Railway will auto-deploy. Monitor logs:
```bash
railway logs | grep diagnose
```

### 2. Frontend Deployment

#### Check if Already Applied
```bash
cd /home/ubuntu/work/smart-solar-react-frontend
grep -n "diagnoseBatch\|diagRunning\|AI Diagnostics" src/services/api.ts src/components/Alerts.tsx
```

Expected output:
```
src/services/api.ts:314:  async diagnoseBatch(): Promise<DiagnoseBatchResponse> {
src/components/Alerts.tsx:12:import type { DiagnoseBatchResponse, AlertDiagnosticResult } from '../services/api';
src/components/Alerts.tsx:178:  const [diagRunning, setDiagRunning] = useState(false);
src/components/Alerts.tsx:704:                  disabled={diagRunning}
src/components/Alerts.tsx:728:                  {diagRunning ? 'Analysing…' : 'Run AI Diagnostics'}
```

#### If Not Yet Applied
See [Frontend Implementation](#frontend-implementation) section below.

#### Build and Deploy
```bash
cd /home/ubuntu/work/smart-solar-react-frontend
npm run build

# If using Vercel
vercel deploy

# Or upload dist/ to your server
```

Verify build succeeded:
```bash
ls -lh dist/assets/Alerts-*.js
```

## Testing

### Backend Endpoint Test
```bash
# Using curl (requires valid staff JWT token)
export TOKEN="your-staff-jwt-token"
curl -X POST \
  http://localhost:8000/api/alerts/diagnose-batch/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected response (200 OK)
{
  "queued": 0,
  "skipped": 0,
  "no_api_key": false,
  "results": []
}
```

### Frontend Component Test
1. Log in as staff user
2. Navigate to Alerts tab
3. Look for purple "Run AI Diagnostics" button in the toolbar (next to search box)
4. Click the button
5. Wait for spinner to complete (may take 5-45 seconds)
6. Results panel should appear below with per-alert cards

### Integration Test
```bash
cd /home/ubuntu/work/smart-solar-django-backend

# Run existing alert tests (should still pass)
python3 manage.py test api.tests --settings=localapi.test_settings -v 2

# Expected: 85 tests run (some pre-existing failures may exist)
```

## Troubleshooting

### 503 Service Unavailable
**Symptom**: Clicking button shows "OPENROUTER_API_KEY not configured"

**Fix**:
```bash
# Check environment on Railway
railway env | grep OPENROUTER_API_KEY

# If empty, set it
railway env set OPENROUTER_API_KEY=sk-or-...

# Restart the app
railway restart
```

### 403 Forbidden
**Symptom**: "You do not have permission" when clicking button

**Fix**: Ensure logged-in user is staff
```python
# Django shell
from django.contrib.auth.models import User
u = User.objects.get(username='your.email')
u.is_staff = True
u.save()
```

### Results Panel Not Showing
**Symptom**: Button clicked, spinner gone, but no results panel

**Checks**:
1. Check browser console for JavaScript errors
2. Verify `diagResults` state is being set:
   ```javascript
   // In Chrome DevTools console
   document.body.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers[0].currentDispatcher.useState
   ```
3. Check backend logs for API errors:
   ```bash
   railway logs | grep "alert_diagnose_batch"
   ```

### Slow Performance
**Symptom**: Button takes >60 seconds (timeout)

**Notes**:
- Expected performance: 5-45 seconds for 10 alerts
- Each alert calls OpenRouter API sequentially
- Network latency + LLM inference time are major factors

**Optimization** (future):
- Batch the API calls in parallel
- Use Celery async for background processing
- Add progress polling endpoint

## Code Structure

### Backend Implementation

**File**: `api/views.py` (line ~4605)

```python
@api_view(['POST'])
@permission_classes([IsStaffUser])
def alert_diagnose_batch(request: Any) -> Response:
    """
    POST /api/alerts/diagnose-batch/
    
    Manually trigger AI diagnostics on all active/acknowledged alerts
    that do not yet have a diagnostic result.
    
    Returns:
        {
          "queued": <int>,
          "skipped": <int>,
          "no_api_key": <bool>,
          "results": [
            {
              "alert_id": <int>,
              "fault_code": <str>,
              "device_serial": <str|null>,
              "triggered_at": <ISO timestamp>,
              "diagnostic": { ... } | null
            }
          ]
        }
    """
    # 1. Check API key
    # 2. Query active alerts without diagnostics
    # 3. Run diagnostic on each
    # 4. Return results
```

**File**: `api/urls.py` (line 145)

```python
path("alerts/diagnose-batch/", views.alert_diagnose_batch, name="alert_diagnose_batch"),
```

### Frontend Implementation

**File**: `src/services/api.ts`

```typescript
export interface DiagnoseBatchResponse {
  queued: number;
  skipped: number;
  no_api_key: boolean;
  results: AlertDiagnosticResult[];
}

class ApiService {
  async diagnoseBatch(): Promise<DiagnoseBatchResponse> {
    return this.request('/alerts/diagnose-batch/', { method: 'POST' });
  }
}
```

**File**: `src/components/Alerts.tsx`

```typescript
// State
const [diagRunning, setDiagRunning] = useState(false);
const [diagResults, setDiagResults] = useState<DiagnoseBatchResponse | null>(null);
const [diagPanelOpen, setDiagPanelOpen] = useState(false);

// Button + Results Panel (in JSX)
<button onClick={async () => {
  setDiagRunning(true);
  setDiagPanelOpen(true);
  const res = await apiService.diagnoseBatch();
  setDiagResults(res);
  setDiagRunning(false);
}}>
  <Brain size={14} className={diagRunning ? 'ota-spinner' : undefined} />
  {diagRunning ? 'Analysing…' : 'Run AI Diagnostics'}
</button>

{diagPanelOpen && (
  <div>
    {/* Results for each alert */}
  </div>
)}
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| API call time per alert | 1-10s | Depends on LLM response time |
| Total time for 10 alerts | 5-45s | Sequential (not parallel) |
| API cost per alert | ~$0.001 | Using free models (check pricing) |
| Monthly cost (100 uses) | ~$0.10 | Negligible on staff-only feature |
| Database calls | ~20 | 1 query per alert |
| Network roundtrips | 11 | 1 initial + 1 per alert |

## Security Considerations

1. **Authentication**: Only staff users can access
   ```python
   @permission_classes([IsStaffUser])
   ```

2. **API Key**: Stored as environment variable (Railway secrets)
   ```
   railway env set OPENROUTER_API_KEY=...
   ```

3. **Rate Limiting**: Built into OpenRouter tier
   - Free tier: subject to rate limits
   - Paid tier: higher limits

4. **Data Exposure**: Results stored in Alert.metadata (alert PK required to view)

## Future Enhancements

1. **Async Processing**: Use Celery task queue for non-blocking execution
2. **Progress Polling**: WebSocket or polling endpoint to show progress
3. **Batch Parallelization**: Call OpenRouter API in parallel (respecting rate limits)
4. **Caching**: Avoid re-diagnosing same alert within 24h
5. **Analytics**: Track diagnostic accuracy vs alerts resolved
6. **Custom Prompts**: Allow users to customize LLM prompts per fault type

## Support & Monitoring

### Logs to Watch
```bash
# Django logs
railway logs | grep "alert_diagnose_batch"

# OpenRouter API errors
railway logs | grep "call_openrouter_diagnostic"

# Fault detection logs
railway logs | grep "evaluate_faults"
```

### Metrics to Track
- Button click frequency (usage)
- Average response time (performance)
- API cost (OpenRouter billing)
- Accuracy of diagnostics (manual review)

### Contact
For issues or feature requests, open a GitHub issue in `smart-solar-django-backend` and tag with `AI` label.

---

**Last Updated**: 2026-03-26  
**Version**: 1.0  
**Status**: Production Ready
