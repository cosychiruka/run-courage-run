import React from "react";
import ErrorBoundary from "./ErrorBoundary";
import { FaHome, FaTv, FaRobot } from "react-icons/fa";

const FloatingMenu = ({ setActiveSection, onOpenChat }) => {
  return (
    <ErrorBoundary fallbackText="Navigation menu couldn't load. Please refresh the page.">
      <div className="floating-menu">
        <button onClick={() => setActiveSection && setActiveSection("home")}>
          <FaHome /> Home
        </button>
        <button onClick={() => setActiveSection && setActiveSection("home")}>
          <FaTv /> The Trenches
        </button>
        <button onClick={() => onOpenChat && onOpenChat()}>
          <FaRobot /> Courage AI
        </button>
      </div>
    </ErrorBoundary>
  );
};

export default FloatingMenu;
