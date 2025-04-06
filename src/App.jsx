import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
// Removed the listen import since we're not using events anymore
import "./App.css";
import TypeWriter from "./components/TypeWriter";  // Import the new component

function App() {
  const [host, setHost] = useState("");
  const [subnets, setSubnets] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [output, setOutput] = useState("Ready to connect...");
  const [enableDns, setEnableDns] = useState(false);
  const [portForwards, setPortForwards] = useState([]);
  const [newPortForward, setNewPortForward] = useState({ remote: "", remotePort: "" });
  const consoleRef = useRef(null);
  
  // New state for saved connections
  const [savedConnections, setSavedConnections] = useState({});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState("");
  const [selectedConnection, setSelectedConnection] = useState("");

  // Load saved connections on initial render
  useEffect(() => {
    loadSavedConnections();
  }, []);

  // Auto-scroll effect when output changes
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  // Load saved connections from the config file
  const loadSavedConnections = async () => {
    try {
      const connections = await invoke("load_connections");
      setSavedConnections(connections);
      setOutput(">> Data-archive accessed. Connection profiles loaded.");
    } catch (error) {
      setOutput(`>> Error accessing archives: ${error}`);
    }
  };

  // Save the current connection
  const saveConnection = async () => {
    try {
      await invoke("save_connection", {
        name: newConnectionName,
        host,
        subnets,
        enableDns,
        portForwards
      });
      
      setShowSaveModal(false);
      setNewConnectionName("");
      await loadSavedConnections();
      setOutput(prev => prev + "\n>> Connection profile saved to the holy archives.");
    } catch (error) {
      setOutput(`>> Error saving connection: ${error}`);
    }
  };

  // Delete a saved connection
  const deleteConnection = async (name) => {
    try {
      await invoke("delete_connection", { name });
      await loadSavedConnections();
      setOutput(prev => prev + `\n>> Profile "${name}" purged from the archives.`);
      if (selectedConnection === name) {
        setSelectedConnection("");
      }
    } catch (error) {
      setOutput(`>> Error deleting connection: ${error}`);
    }
  };

  // Load a saved connection
  const loadConnection = (name) => {
    const connection = savedConnections[name];
    if (connection) {
      setHost(connection.host);
      setSubnets(connection.subnets);
      setEnableDns(connection.enable_dns);
      setPortForwards(connection.port_forwards || []);
      setSelectedConnection(name);
      setOutput(`>> Profile "${name}" loaded from the archives. The machine spirit awaits your command.`);
    }
  };

  // Omnissiah ritual message with ASCII art
  const omnissiahPraise = `
  ⚙️ INITIATING CONNECTION RITUAL ⚙️

  >> Praise be to the Omnissiah!
  >> Appeasing the machine spirit...
  >> Ritual incense applied to network interface
  >> Binary prayers transmitted
  >> Establishing sacred connection...
  `;

  const addPortForward = () => {
    if (newPortForward.remote && newPortForward.remotePort) {
      setPortForwards([...portForwards, { ...newPortForward }]);
      setNewPortForward({ remote: "", remotePort: "" });
    }
  };

  const removePortForward = (index) => {
    const updatedPortForwards = [...portForwards];
    updatedPortForwards.splice(index, 1);
    setPortForwards(updatedPortForwards);
  };

  // Remove the event listener useEffect completely
  
  // Enhanced polling mechanism (runs both when connected and after connection attempts)
  useEffect(() => {
    // Start polling immediately after connecting to capture initial output
    const shouldPoll = status === "connected" || status === "connecting";
    
    if (shouldPoll) {
      // Set up polling interval
      const interval = setInterval(async () => {
        try {
          const newOutput = await invoke("get_sshuttle_output");
          if (newOutput && newOutput.length > 0) {
            setOutput(prev => {
              return prev + "\n" + newOutput.map(line => {
                const linePrefix = line.includes("ERROR:") ? ">> [ERR] " : ">> ";
                return linePrefix + line;
              }).join("\n");
            });
          }
        } catch (error) {
          console.error("Error polling output:", error);
        }
      }, 300); // Poll more frequently (300ms) for more responsive updates
      
      return () => clearInterval(interval);
    }
  }, [status]);

  // Check status on app load (only once)
  useEffect(() => {
    let initialCheck = true;
    
    async function check() {
      try {
        const isRunning = await invoke("check_sshuttle_running");
        console.log(isRunning ? "sshuttle is running" : "sshuttle is not running");
        
        if (isRunning) {
          // sshuttle is running
          setStatus("connected");
          if (initialCheck) {
            setOutput("Ready to connect...\n>> Detected active sshuttle connection.");
            initialCheck = false;
          } else {
            setOutput(prev => prev + "\n>> Detected active sshuttle connection.");
          }
        } else {
          // sshuttle is not running
          setStatus("disconnected");
          if (status === "connected") {
            setOutput(prev => prev + "\n>> Connection to the noosphere has been terminated.");
          }
        }
      } catch (error) {
        console.error("Error checking sshuttle status:", error);
      }
    }
    
    check();
  }, []);  // Empty dependency array ensures it only runs once on mount
  
  // Function to check if sshuttle is running
  async function checkSshuttleStatus() {
    try {
      const isRunning = await invoke("check_sshuttle_running");
      console.log(isRunning ? "sshuttle is running" : "sshuttle is not running");
      if (isRunning) {
        // sshuttle is running
        if (status !== "connected") {
          setStatus("connected");
          setOutput(prev => prev + "\n>> Detected active sshuttle connection.");
        }
      } else {
        // sshuttle is not running
        if (status === "connected") {
          setStatus("disconnected");
          setOutput(prev => prev + "\n>> Connection to the noosphere has been terminated.");
        }
      }
    } catch (error) {
      // Handle actual errors (not just "not running" status)
      console.error("Error checking sshuttle status:", error);
      setOutput(prev => prev + "\n>> Error querying machine spirit: " + error);
      
      // Assume disconnected on error
      if (status === "connected") {
        setStatus("disconnected");
      }
    }
  }

  // Update connect function to set an intermediate state
  async function connect() {
    try {
      // First display the Omnissiah praise and ASCII art
      setOutput(omnissiahPraise);
      
      // Wait for the typing to finish
      await new Promise(resolve => setTimeout(resolve, omnissiahPraise.length * 15));
      
      setOutput(prev => prev + "\n\n>> Invoking sshuttle protocols...");
      setStatus("connecting"); // Add this intermediate state to start polling
      setOutput(prev => prev + "\n>> Requesting machine spirit privileges from the Omnissiah...");
      
      // Format port forwards for display
      const portForwardStr = portForwards.length > 0 
        ? "\n>> Establishing binary conduits: " + 
          portForwards.map(pf => `${pf.remote}:${pf.remotePort}`).join(", ")
        : "";
      
      if (portForwardStr) {
        setOutput(prev => prev + portForwardStr);
      }
      
      // Pass the DNS flag and port forwards to the Rust function
      const result = await invoke("run_sshuttle", { 
        host, 
        subnets,
        dns: enableDns,
        portForwards: portForwards
      });
      
      setOutput(prev => prev + "\n\n" + result + "\n\n>> The Omnissiah is pleased with your connection!");
      setStatus("connected");
      
      setOutput(prev => prev + "\n\n>> Receiving data stream from the noosphere...");
      
      // After connection attempt, verify it's actually running
      setTimeout(async () => {
        await checkSshuttleStatus();
      }, 2000);
      
    } catch (error) {
      // Special handling for permission errors
      if (error.toString().includes("elevated privileges")) {
        setOutput(prev => prev + `\n\n>> ERROR: ${error}\n\n>> The machine spirit requires higher clearance level.\n>> Please grant the requested privileges to continue.`);
      } else {
        setOutput(prev => `Error: ${error}\n\n>> The machine spirit is displeased. Retry the sacred ritual.`);
        setStatus("disconnected");
      }
    }
  }

  async function disconnect() {
    setOutput(">> Severing connection to the noosphere...");
    
    try {
      const result = await invoke("stop_sshuttle");
      setOutput(prev => prev + "\n" + result + 
        "\n>> Connection terminated. The machine spirit returns to dormancy." +
        "\n>> The Omnissiah awaits your return.");
      setStatus("disconnected");
      
      // After disconnect attempt, verify it's actually stopped
      setTimeout(async () => {
        await checkSshuttleStatus();
      }, 2000); // Give it 2 seconds to terminate
      
    } catch (error) {
      setOutput(prev => prev + 
        "\n>> Error in termination ritual: " + error + 
        "\n>> Attempting emergency shutdown procedures...");
        
      // Short timeout before updating status even if there was an error
      // This gives the user feedback even if the backend had issues
      setTimeout(() => setStatus("disconnected"), 1500);
    }
  }

  // Add this function to get detailed status info
  async function getDetailedStatus() {
    try {
      const shuttleRunning = await invoke("check_sshuttle_running")
        .then(() => true)
        .catch(() => false);
      
      // Get process details if running
      let processInfo = "No active process";
      if (shuttleRunning) {
        // You could add a new Rust function to get process details
        // For now we'll just use a basic message
        processInfo = "Process detected in system memory";
      }
      
      setOutput(prev => prev + `\n
>> Status Report:
>> ------------------------------------------------
>> Sshuttle Running: ${shuttleRunning ? "YES ✓" : "NO ✗"}
>> Process Info: ${processInfo}
>> UI Status: ${status}
>> ------------------------------------------------
>> Status check completed by order of the Omnissiah.
      `);
    } catch (error) {
      setOutput(prev => prev + `\n>> Error checking status: ${error}`);
    }
  }

  // Determine if the retro theme should have the connected class for the glow effect
  const retroThemeClass = `container retro-theme ${status === "connected" ? "connected" : ""}`;

  return (
    <main className={retroThemeClass}>
      <h1>Astropathic Relay</h1>
      
      <div className="two-column-layout">
        {/* Console Output - Left Column */}
        <div className="console-column">
          <h3>Cogitator Interface</h3>
          <div className="console-output" ref={consoleRef}>
            {/* Replace the static pre with TypeWriter */}
            <pre>
              <TypeWriter text={output} speed={3} />
            </pre>
          </div>
        </div>
        
        {/* Right Column - Controls */}
        <div className="controls-column">
          {/* Saved Connections Section */}
          <div className="saved-connections-section">
            <h3>Data Archives</h3>
            <div className="saved-connections-controls">
              <select 
                value={selectedConnection}
                onChange={(e) => loadConnection(e.target.value)}
                className="connection-select"
              >
                <option value="">-- Select Profile --</option>
                {Object.keys(savedConnections).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button 
                className="retro-button save-btn"
                onClick={() => setShowSaveModal(true)}
              >
                Save
              </button>
              {selectedConnection && (
                <button 
                  className="retro-button delete-btn"
                  onClick={() => deleteConnection(selectedConnection)}
                >
                  Purge
                </button>
              )}
            </div>
          </div>
          
          <div className="form-container">
            <div className="input-group">
              <label>Remote Host:</label>
              <input 
                type="text" 
                placeholder="user@remote-server.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            
            <div className="input-group">
              <label>Subnets:</label>
              <input 
                type="text" 
                placeholder="10.0.0.0/8,192.168.0.0/16"
                value={subnets}
                onChange={(e) => setSubnets(e.target.value)}
              />
            </div>
            
            <div className="checkbox-group">
              <input
                id="dns-checkbox"
                type="checkbox"
                checked={enableDns}
                onChange={(e) => setEnableDns(e.target.checked)}
              />
              <label htmlFor="dns-checkbox">Enable DNS forwarding</label>
            </div>
            
            {/* Port Forwarding Section */}
            <div className="port-forward-section">
              <h3>Port Forwards</h3>
              <div className="port-forward-form">
                <div className="port-forward-inputs">
                  <input 
                    type="text"
                    placeholder="Remote host"
                    value={newPortForward.remote}
                    onChange={(e) => setNewPortForward({...newPortForward, remote: e.target.value})}
                  />
                  <input 
                    type="text"
                    placeholder="Remote port"
                    value={newPortForward.remotePort}
                    onChange={(e) => setNewPortForward({...newPortForward, remotePort: e.target.value})}
                  />
                  <button className="retro-button add-port" onClick={addPortForward}>+</button>
                </div>
              </div>
              
              {/* List of port forwards */}
              <div className="port-forward-list">
                {portForwards.map((pf, index) => (
                  <div key={index} className="port-forward-item">
                    <span>{pf.remote}:{pf.remotePort}</span>
                    <button className="retro-button remove-port" onClick={() => removePortForward(index)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="button-group">
              <button 
                className="retro-button primary" 
                onClick={connect}
                disabled={status === "connected"}
              >
                Connect
              </button>
              <button 
                className="retro-button secondary"
                onClick={disconnect}
                disabled={status === "disconnected"}
              >
                Disconnect
              </button>
              <button 
                className="retro-button status-check"
                onClick={async () => {
                  setOutput(prev => prev + "\n>> Querying machine spirit status...");
                  await checkSshuttleStatus();
                }}
              >
                Check Status
              </button>
              <button 
                className="retro-button info"
                onClick={getDetailedStatus}
              >
                Diagnostic
              </button>
            </div>
          </div>
          
          <div className="status-container">
            <div className={`status-indicator ${status === "connected" ? "online" : "offline"}`}>
              <span className="status-dot"></span>
              <span className="status-text">
                {status === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Save Connection Modal */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Archive Connection Profile</h3>
            <p>Enter a designation for this connection profile:</p>
            <input 
              type="text"
              value={newConnectionName}
              onChange={(e) => setNewConnectionName(e.target.value)}
              placeholder="Profile name"
              className="modal-input"
            />
            <div className="modal-buttons">
              <button 
                className="retro-button cancel-btn"
                onClick={() => {
                  setShowSaveModal(false);
                  setNewConnectionName("");
                }}
              >
                Cancel
              </button>
              <button 
                className="retro-button save-btn"
                onClick={saveConnection}
                disabled={!newConnectionName}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;