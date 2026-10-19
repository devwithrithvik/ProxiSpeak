
import "./Header.css";
import ProfileDropdown from "./ProfileDropdown";

function Header({ user, onNavigate, onLogout }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="header-logo">P</div>
        <div className="header-brand-text">
          <h2>ProxiSpeak</h2>
          <span>Virtual Office</span>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className="nav-link"
          onClick={() => onNavigate("VirtualOffice")}
        >
          Office
        </button>

        <button
          className="nav-link"
          onClick={() => onNavigate("People")}
          >
          People
        </button>

        <button
          className="nav-link"
          onClick={() => onNavigate("MyTeam")}
        >
          My Team
        </button>

        <button
          className="nav-link"
          onClick={() => onNavigate("Meetings")}
        >
          Meetings
        </button>

        <button
          className="nav-link"
          onClick={() => onNavigate("Chat")}
        >
          Chat
        </button>

        {/* <button
          className="nav-link"
          onClick={() => onNavigate("Settings")}
        >
          Settings
        </button> */}
      </nav>

      <div className="header-profile">
        <ProfileDropdown
          user={user}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}

export default Header;