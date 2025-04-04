import React, { useState } from 'react';
import './Form.css';

const ConnectionForm = () => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!host || !port || !username) {
      setError('All fields are required.');
      return;
    }
    setError('');
    // Call the function to run sshuttle with the provided parameters
    // Example: runSshuttle({ host, port, username });
  };

  return (
    <form className="connection-form" onSubmit={handleSubmit}>
      <h2>SSHuttle Connection</h2>
      {error && <p className="error">{error}</p>}
      <div>
        <label htmlFor="host">Host:</label>
        <input
          type="text"
          id="host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="Enter host"
        />
      </div>
      <div>
        <label htmlFor="port">Port:</label>
        <input
          type="number"
          id="port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          placeholder="Enter port"
        />
      </div>
      <div>
        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />
      </div>
      <button type="submit">Connect</button>
    </form>
  );
};

export default ConnectionForm;