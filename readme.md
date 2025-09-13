# Kibo — Voice Maps (Gemini)

Kibo is a voice-first, Gemini-powered mapping and robot control dashboard. It combines advanced voice interaction, real-time computer vision, and intuitive navigation for seamless human-robot collaboration.

---

## 🚀 Features

- **Voice-First Navigation:**
  - Issue map and robot commands using natural language.
  - Real-time voice transcription and assistant responses.
- **Gemini AI Integration:**
  - Leverages Gemini for intelligent command parsing and contextual assistance.
- **Live Camera & Object Detection:** 3
  - View live camera feed and run on-device object detection (COCO-SSD, TensorFlow.js).
- **Interactive Map:**
  - Set origin, destination, and waypoints.
  - Multiple travel modes: driving, walking, transit, cycling.
  - Drop and clear custom markers.
- **Robot Control Panel:**
  - Direct robot movement and status monitoring.
- **Modern UI:**
  - Responsive, accessible, and visually appealing interface.

---

## 🗂️ Project Structure

```
public/
  app.js                # Main app logic
  camera.js             # Camera and object detection
  camera_test.html      # Camera test page
  dashboard.html        # Robot dashboard UI
  dashboard.js          # Dashboard logic
  detection_client.js   # Object detection client
  gemini.js             # Gemini AI integration
  index.html            # Main entry point
  map.js                # Map and navigation logic
  navigation.js         # Route and travel mode logic
  robot.js              # Robot control logic
  sidebar.js            # Sidebar and UI controls
  styles.css            # Main styles
  voice.js              # Voice recognition and TTS
  ...
server.js               # Node.js backend server
package.json            # Project metadata and scripts
readme.md               # This file
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/SathvikHaridasu/robo-dawg.git
cd robo-dawg
npm install
```

### Running the App

```bash
npm run dev
```

- Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

---

## 🧩 Scripts

- `npm run dev` — Start the development server
- `npm start` — Start the production server

---

## 🤖 Voice & AI
- Voice recognition and synthesis powered by browser APIs (can be extended to VAPI or other services).
- Gemini integration for advanced assistant features.

---

## 📷 Computer Vision
- Uses TensorFlow.js and COCO-SSD for real-time object detection in the browser.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Credits
- [TensorFlow.js](https://www.tensorflow.org/js)
- [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
- [Font Awesome](https://fontawesome.com/)
- [Google Fonts](https://fonts.google.com/)

---

## 📬 Contact

For questions, suggestions, or contributions, please open an issue or contact the maintainer via GitHub.
