import { createRoot } from 'react-dom/client';
import App from './App';

// No StrictMode: its double-mounted effects would open the webcam and MediaPipe twice in dev.
createRoot(document.getElementById('root')!).render(<App />);
