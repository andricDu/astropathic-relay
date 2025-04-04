import React from 'react';
import './StatusIndicator.css';

const StatusIndicator = ({ isConnected }) => {
  return (
    <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
};

export default StatusIndicator;