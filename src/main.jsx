import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

// Make sure we're targeting an element that exists
const rootElement = document.getElementById("root");

// Check if the root element exists
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Could not find root element! Make sure index.html contains <div id=\"root\"></div>");
}