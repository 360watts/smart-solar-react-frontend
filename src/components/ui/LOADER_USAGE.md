# Unified Loader Component Usage Guide

## Quick Examples

### 1. Inline Loader in Button (with label)
```typescript
import { Loader } from '@/components/ui/Loader';

<button disabled={isLoading} style={{...}}>
  <Loader size={16} label={isLoading ? 'Saving...' : undefined} />
  Save Changes
</button>
```

### 2. Inline Loader in Button (without label)
```typescript
<button disabled={isLoading} style={{...}}>
  {isLoading && <Loader size={14} />}
  Delete User
</button>
```

### 3. Full-Screen Overlay Loader
```typescript
{isLoading && <Loader fullScreen label="Loading data..." />}
```

### 4. Custom Colors & Sizes
```typescript
<Loader 
  size={20}
  color="#10b981"  // Green
  label="Syncing..." 
  duration={0.8}
/>
```

## Implementation Pattern

### Before (Duplicated code in every component):
```typescript
<button disabled={isLoading} style={{...}}>
  {isLoading && (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: 'white',
      animation: 'spin 0.6s linear infinite',
    }} />
  )}
  Submit
</button>
```

### After (Reusable component):
```typescript
<button disabled={isLoading} style={{...}}>
  {isLoading && <Loader size={16} />}
  Submit
</button>
```

## Available Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | number | 16 | Spinner size in pixels |
| `color` | string | 'white' | CSS color value |
| `duration` | number | 0.6 | Animation duration in seconds |
| `label` | string | undefined | Optional text next to spinner |
| `fullScreen` | boolean | false | Show as full-page overlay |
| `inline` | boolean | true | Show as inline element |

## Common Use Cases

### Create/Update Forms
```typescript
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  try {
    setIsSaving(true);
    await apiService.updateUser(data);
  } finally {
    setIsSaving(false);
  }
};

<button disabled={isSaving} onClick={handleSave}>
  {isSaving && <Loader size={16} />}
  Save Changes
</button>
```

### Delete Confirmation Modal
```typescript
<button disabled={isDeleting} style={{...}}>
  {isDeleting && <Loader size={14} color="#dc3545" />}
  {isDeleting ? 'Deleting...' : 'Delete'}
</button>
```

### Full-Page Loading
```typescript
{isPageLoading && <Loader fullScreen label="Loading dashboard..." />}
```

### Background Operations
```typescript
{isExporting && (
  <Loader fullScreen label="Exporting data... This may take a minute" />
)}
```

## Styling Notes

- The loader automatically includes the `@keyframes spin` animation CSS
- No external dependencies needed
- Works with Tailwind CSS and custom styles
- Respects dark/light mode through parent element colors
- Z-index set to 9999 for full-screen mode

## Migration Path

1. **Done:** Created reusable `Loader` component at `src/components/ui/Loader.tsx`
2. **Ready to do:** Update Users.tsx to use `<Loader />` instead of inline spinners
3. **Ready to do:** Update Employees.tsx to use `<Loader />` instead of inline spinners
4. **Ready to do:** Replace any other inline spinners in the app

Would you like me to update the Users and Employees components to use this new Loader component?
