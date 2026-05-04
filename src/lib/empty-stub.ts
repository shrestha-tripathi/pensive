// Empty stubs for optional Tiptap collab modules. DragHandle imports them
// statically but only uses them in collab mode (which we don't enable).
// We can't proxy named exports at module level, so list all known names that
// extension-drag-handle / extension-collaboration / y-tiptap might import.
const noop = () => null;
const noopKey = { key: 'noop' };

export const ySyncPluginKey = noopKey;
export const yUndoPluginKey = noopKey;
export const absolutePositionToRelativePosition = noop;
export const relativePositionToAbsolutePosition = noop;
export const isChangeOrigin = () => false;
export const ySyncPlugin = () => ({ key: noopKey });
export const yUndoPlugin = () => ({ key: noopKey });
export const yCursorPlugin = () => ({ key: noopKey });
export const undo = noop;
export const redo = noop;
export const Collaboration = { name: 'collaboration', configure: () => ({}) };
export const CollaborationCaret = { name: 'collaborationCaret', configure: () => ({}) };

export default {};
