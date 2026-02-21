/**
 * Centralized z-index scale for stacking order.
 * CURSORS is the max for workspace overlays — nothing should exceed it.
 * MODALS intentionally sit above cursors when open.
 */
export const Z_INDEX = {
  GRID: 0,
  CANVAS: 1,
  CURSOR_READOUT: 10,
  TOOLBAR_OVERLAY: 10,
  NAV: 100,
  DROPDOWN: 100,
  /** Max for workspace — cursors always on top of canvas and other in-canvas UI */
  CURSORS: 100_000,
  /** Mobile hamburger drawer — above toolbar, below modals */
  DRAWER: 50_000,
  /** Modals/dialogs can overlay everything including cursors when open */
  MODALS: 1_000_000,
} as const
