
import { useState, useEffect, useRef } from "react";
import "./ProfileDropdown.css";

function ProfileDropdown({ user, onNavigate, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const menuItems = [
    {
      label: "My Profile",
      description: "View employee details",
      page: "Profile",
      icon: "👤",
    },
    // {
    //   label: "People",
    //   description: "Browse colleagues",
    //   page: "People",
    //   icon: "👥",
    // },
    // {
    //   label: "My Team",
    //   description: "Members and team overview",
    //   page: "MyTeam",
    //   icon: "🤝",
    // },
    // {
    //   label: "Meetings",
    //   description: "Upcoming meetings and attendance",
    //   page: "Meetings",
    //   icon: "📅",
    // },
    // {
    //   label: "Chat",
    //   description: "Conversations and messages",
    //   page: "Chat",
    //   icon: "💬",
    // },
    {
      label: "Settings",
      description: "Audio and account preferences",
      page: "Settings",
      icon: "⚙️",
    },
  ];

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleNavigation(page) {
    setIsOpen(false);
    onNavigate(page);
  }

  const displayName = user?.name || "Rajdip Jana";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        className="profile-trigger"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Open profile menu"
        aria-expanded={isOpen}
      >
        <span className="profile-trigger-avatar">{initials}</span>
        <span className="profile-trigger-arrow">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="profile-dropdown">
          <div className="profile-menu-user">
            <span className="profile-menu-avatar">{initials}</span>

            <div className="profile-menu-user-info">
              <strong>{displayName}</strong>
              <span>Software Developer</span>
              <span className="profile-online">
                <span className="online-dot" /> Online
              </span>
            </div>
          </div>

          <div className="profile-menu-divider" />

          <nav className="profile-menu-items" aria-label="Profile navigation">
            {menuItems.map((item) => (
              <button
                type="button"
                className="profile-menu-item"
                key={item.page}
                onClick={() => handleNavigation(item.page)}
              >
                <span className="profile-menu-item-icon">{item.icon}</span>
                <span className="profile-menu-item-text">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <span className="profile-menu-chevron">›</span>
              </button>
            ))}
          </nav>

          <div className="profile-menu-divider" />

          <button
            type="button"
            className="profile-logout-button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            <span>↪</span> Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileDropdown;
