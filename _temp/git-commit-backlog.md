# Git Commit Backlog

## 2025-01-27: Music mini player mobile touch improvements

- Touch loupe: magnifying glass shows what's under thumb when dragging pin (DOM clone approach)
- 60px invisible touch target around pin for easier grabbing
- touchcancel handlers for all touch interactions (prevents stuck states)
- e.touches.length guards in touchmove handlers
- Loupe edge clamping (stays 10px from viewport bounds)
- iOS button consistency (44px touch targets, webkit fixes)
- Pin indicator in loupe: needle tip at drop point, head 6px right offset

