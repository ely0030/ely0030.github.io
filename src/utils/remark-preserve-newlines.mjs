export function remarkPreserveNewlines() {
  return (tree) => {
    // This plugin intentionally does nothing for now
    // The issue is that markdown already splits on double newlines
    // We need a different approach
    return tree;
  };
}