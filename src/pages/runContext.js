import { useOutletContext } from 'react-router-dom';

// Access the { run, reload } that RunLayout provides to its nested routes.
// Kept in its own module so RunLayout.jsx only exports its component (fast-refresh safe).
export const useRunContext = () => useOutletContext();
