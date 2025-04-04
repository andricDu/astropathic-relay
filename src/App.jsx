import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [host, setHost] = useState("");
  const [subnets, setSubnets] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [output, setOutput] = useState("Ready to connect...");
  const [enableDns, setEnableDns] = useState(false);
  // Add state for port forwards
  const [portForwards, setPortForwards] = useState([]);
  const [newPortForward, setNewPortForward] = useState({ remote: "", remotePort: "" });
  const consoleRef = useRef(null);

  // Auto-scroll effect when output changes
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  // Omnissiah ritual message with ASCII art
  const omnissiahPraise = `
  ⚙️ INITIATING CONNECTION RITUAL ⚙️

       _____/\\\\\\\\\\\\\\\\\\\\\\___        
        ___/\\\\\\/////////\\\\\\___       
         __\\//\\\\\\______\\///____      
          ___\\////\\\\\\___________     
           ______\\////\\\\\\________    
            _________\\////\\\\\\_____ 
             __/\\\\\\______\\//\\\\\\__  
              _\\///\\\\\\\\\\\\\\\\\\\\\\/___
               ___\\///////////_____
  
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

  async function connect() {
    try {
      // First display the Omnissiah praise and ASCII art
      setOutput(omnissiahPraise);
      
      // Wait 2 seconds for dramatic effect before continuing with connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setOutput(prev => prev + "\n\n>> Invoking sshuttle protocols...");
      
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
    } catch (error) {
      setOutput(`Error: ${error}\n\n>> The machine spirit is displeased. Retry the sacred ritual.`);
      setStatus("disconnected");
    }
  }

  function disconnect() {
    setOutput(">> Severing connection to the noosphere...");
    setStatus("disconnected");
    setTimeout(() => {
      setOutput(">> Connection terminated. The Omnissiah awaits your return.");
    }, 500);
  }

  // Determine if the retro theme should have the connected class for the glow effect
  const retroThemeClass = `container retro-theme retro-theme-size ${status === "connected" ? "connected" : ""}`;

  return (
    <main className={retroThemeClass}>
      <h1>Astropathic Relay</h1>
      
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
        
        {/* New Port Forwarding Section */}
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
      
      <div className="console-output" ref={consoleRef}>
        <pre>{output}</pre>
      </div>
    </main>
  );
}

export default App;