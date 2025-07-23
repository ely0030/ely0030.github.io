# Changelog - 2025-07-21

## Summary
Enhanced UI aesthetics for protected login page and planning wall card selection

## Changes

### Protected Mode Login Page
- **Redesigned login UI**: Simplified from apache-style header/rules to minimal password box
- **Applied deep blue theme** (#002147): Added background, white text, transparent form elements
- **Reverted to minimal style**: Removed deep blue, kept clean monospace aesthetic
- **Repositioned form**: Moved from centered to 40vh from top for better visual balance
- **Changed layout**: Login button moved below password input (vertical layout)
- **Location**: `https-proxy-protected.cjs:80-187`

### Planning Wall Card Selection
- **Refined selection styling**: Changed from harsh 2px red border to subtle 1px orange (#ff5500)
- **Added visual depth**: Double shadow effect (outer + inset) for elegant selection
- **Subtle background tint**: Added barely visible orange tint to selected cards
- **Smooth transitions**: Added 0.15s cubic-bezier transitions for border, shadow, and background
- **Header emphasis**: Selected card headers get slightly darker tint
- **Location**: `planning-wall.astro:122-130, 145-152`

### Documentation Updates
- **CLAUDE.md**: Added pitfall #26 for protected login styling location
- **planning-wall.md**: Updated card selection styling section with design evolution
- **protected-mode-critical.md**: Enhanced login page design section with full details

## Key Insights
- Protected mode login is embedded HTML in proxy file, not a component
- User wanted "apache-like but minimal" not old-school design
- "Finesse" meant visual design refinement, not animations
- Three different password UIs exist in the system (PasswordGate, index inline, proxy)