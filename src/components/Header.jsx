import React from "react";
import "./RetroTheme.css"; // Importing retro theme styles
import terminalIcon from "../assets/icons/terminal.svg"; // Importing terminal icon

const Header = () => {
  return (
    <header className="header">
      <img src={terminalIcon} alt="Terminal Icon" className="header-icon" />
      <h1 className="header-title">SSHuttle Launcher</h1>
      <p className="header-subtitle">A Retro Tool for Modern Connections</p>
    </header>
  );
};

export default Header;