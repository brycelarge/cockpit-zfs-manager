import "cockpit-dark-theme";
import 'patternfly/patternfly-6-cockpit.scss';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './components/App.jsx';
import "./zfs-manager.scss";

const container = document.getElementById('app');
if (container) {
    const root = createRoot(container);
    root.render(React.createElement(App));
}

