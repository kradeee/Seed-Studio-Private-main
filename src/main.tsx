import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../components/studio/Studio';
import {trackPageview} from '../components/studio/analytics';
import '../components/studio/styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Studio/></StrictMode>);
trackPageview();
