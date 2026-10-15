# Illustrative map: failure modes to retain in browser journeys

The owner replaced the v12 3D renderer with the approved illustrated map on 15 October 2026. The existing end-to-end journeys retain their original game assertions and browser configuration. Renderer-specific checks now target the actual image.

- The illustration may fail or arrive after a choice: the visible agenda, saved decision, mobilisation and funded project must remain usable; a later successful reload must recover the image and saved state.
- A subject selection, choice, inspection, resize, reduced-motion setting or navigation panel may accidentally remount the map/image or reset the view. Verify the same image/artboard and preserved zoom without spending turns.
- An image may be unresolved, stretched, clipped or use a low-resolution canvas substitute. Verify a decoded SVG image with intrinsic size, a valid display box, stable aspect ratio and no canvas on a device with DPR 2; retain actual screenshots. The embedded source artwork has finite detail and this is not proof of artistic fidelity.
- SVG and its embedded artwork may be missing offline. Verify the generated cache contains the actual image URL, contains no 3D models, then reload offline and make a real social response.
- WebGL might still be loaded implicitly. Observe resource requests and disable WebGL while keeping the ordinary illustrated view and keyboard decisions usable.
- Rendering may invent or omit movement/project state. Keep the real school funding/delivery journey, 30-decision mandate/replay, and funded hospital project/navigation assertions.
