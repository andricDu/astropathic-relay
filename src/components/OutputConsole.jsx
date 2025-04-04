import React from 'react';
import './Console.css';

const OutputConsole = ({ output }) => {
  return (
    <div className="output-console">
      <h2>Output Console</h2>
      <pre>{output}</pre>
    </div>
  );
};

export default OutputConsole;