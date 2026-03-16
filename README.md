# Impermanence

*An interactive installation for hand, strings, and disappearing light*

---

## Artist Statement

A hand-tracking camera renders your fingers as a constellation of stars. Pinch any string to pull it from its path; release to hear it ring. Each point of contact leaves a trace of light that fades over twenty-five seconds, erasing itself as quietly as it came. The work is reset by every person who leaves.

This piece is about impermanence — not as an abstract philosophy, but as a physical sensation. The gesture of pinching and pulling is one of holding on. The light that remains after you let go is the closest thing to a memory the work has. Then it dissolves, and the space is empty again, waiting for the next hand.

The body is not in control here. It is a disturbance.

---

## How It Works

The piece uses a webcam to track 21 keypoints on the user's hand in real time. When the thumb tip and index finger tip come within a threshold distance, a "pinch" gesture is detected. The nearest string is grabbed and follows the midpoint between the two fingertips. On release, the string vibrates physically and a sound is triggered.

The hand is rendered as a **constellation** — joints appear as stars of varying brightness, connected by faint lines. Selected keypoints (fingertips and palm base) leave a **motion trail** as the hand moves, fading over ~300ms.

Each contact point between hand and string generates a **light trace** on the canvas. Traces persist for 25 seconds, then fade with an eased decay curve — staying bright longer, dissolving quickly at the end.

Sound is synthesised using three layered oscillators (triangle + triangle + sine) tuned to a **pentatonic scale** across 12 strings (D2–C5). Lower strings have a longer release; higher strings decay faster, matching the physical behaviour of a real instrument.

---

## Technical Stack

| Component | Library / Tool |
|---|---|
| Creative coding / canvas | [p5.js](https://p5js.org) v1.9.0 |
| Hand tracking | [ml5.js](https://ml5js.org) v0.12.2 (MediaPipe HandPose) |
| Sound synthesis | p5.sound (bundled with p5.js) |
| Runtime | Browser — no installation required |

---

## Requirements

**Hardware**
- A webcam (built-in or external)
- A projector or large display (recommended: ≥ 80 inches for installation context)
- A darkened room or controlled lighting environment

**Software**
- A modern browser (Chrome or Firefox recommended)
- Internet connection on first load (to fetch ml5.js from CDN)

**Performance**
- A machine capable of running real-time ML inference at 30fps
- Tested on: MacBook Pro M1, Chrome 120+

---

## Lighting & Staging Notes

The piece is designed for a **dark environment**. The strings, star constellation, and light traces are all rendered against a black canvas — ambient light washes out the visuals significantly.

Recommended setup:
- Dim or turn off overhead lighting in the interaction zone
- Position the webcam at **eye level or slightly below**, facing the performer directly
- The performer should stand **0.5–1.5m from the camera** for accurate hand tracking
- Avoid **strong backlight** (e.g. windows behind the performer) — it confuses the hand detection model
- A side light or soft front fill helps the camera see the hand clearly without competing with the projection

For projection: mount the projector so the image fills the wall behind or beside the performer, allowing the hand to be seen within the projected space.

---

## Running the Piece

**Option A — p5.js Web Editor (simplest)**

1. Open [editor.p5js.org](https://editor.p5js.org)
2. Replace the contents of `sketch.js` with the provided `sketch.js`
3. Replace the contents of `index.html` with the provided `index.html`
4. Press the Play button and allow camera access when prompted

**Option B — Local server**

```bash
# Navigate to the project folder
cd path/to/impermanence

# Start a local HTTP server (Python 3)
python3 -m http.server 8000

# Open in browser
# http://localhost:8000
```

> Note: the file cannot be opened directly as `file://` — the browser will block camera access. A local server is required.

---

## Adjustable Parameters

All parameters are defined at the top of `sketch.js` and can be edited directly.

| Parameter | Default | Effect |
|---|---|---|
| `NUM_STRINGS` | `12` | Number of strings across the frame |
| `FADE_MS` | `25000` | Duration (ms) for light traces to fully dissolve |
| `PINCH_PX` | `35` | Pixel distance threshold for pinch detection — lower = harder to trigger |
| `STIFFNESS` | `0.2` | String tension — higher = snappier rebound |
| `DAMPING` | `0.65` | Vibration decay — lower = longer oscillation |
| `TRAIL_LEN` | `18` | Number of frames stored for motion trail |
| `BASE_FREQS` | pentatonic D2–C5 | Fundamental frequencies for each string |

---

## File Structure

```
impermanence/
├── index.html       # Entry point, loads libraries
├── sketch.js        # Main p5.js sketch (all logic)
└── README.md
```

---

## Concepts & References

**Conceptual influences**

- *Wabi-sabi* — the Japanese aesthetic of transience and imperfection; the beauty of things that are incomplete or passing
- *Anicca* (無常) — the Buddhist concept of impermanence; all conditioned phenomena are in constant flux
- The Zen practice of sand mandalas: intricate, deliberate, then erased

**Artistic references**

- Camille Utterback & Romy Achituv — *Text Rain* (1999): body interaction with projected falling elements
- Golan Levin — *Messa di Voce* (2003): real-time audiovisual body-responsive performance
- Ryoji Ikeda — minimalist audiovisual works exploring data, time, and disappearance
- Chris Salter — research and practice on haptic and sensory installations

**Technical references**

- ml5.js HandPose documentation — [ml5js.org/reference/api-HandPose](https://ml5js.org/reference/api-HandPose/)
- Daniel Shiffman, *The Nature of Code* — wave simulation and spring physics
- p5.sound reference — [p5js.org/reference/#/libraries/p5.sound](https://p5js.org/reference/#/libraries/p5.sound)