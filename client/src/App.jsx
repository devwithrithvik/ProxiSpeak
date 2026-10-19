
import { useState, useEffect } from "react";

import Login from "./pages/Login";
import VirtualOffice from "./pages/VirtualOffice";
import Profile from "./pages/Profile";
import People from "./pages/People";
import MyTeam from "./pages/MyTeam";
import Meetings from "./pages/Meetings";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("VirtualOffice");

  // Keep browser history synchronized with the current page.
  useEffect(() => {
    window.history.replaceState(
      { page: "VirtualOffice" },
      "",
      window.location.pathname
    );

    function handlePopState(event) {
      const page = event.state?.page;

      if (page) {
        setCurrentPage(page);
      } else {
        setCurrentPage("VirtualOffice");
      }
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function handleLogin(userData) {
    setUser(userData);
    setCurrentPage("VirtualOffice");
  }

  function handleLogout() {
    setUser(null);
    setCurrentPage("VirtualOffice");
    window.history.replaceState(null, "", "/");
  }

  function handleNavigate(page) {
    if (page === currentPage) return;

    window.history.pushState(
      { page },
      "",
      window.location.pathname
    );

    setCurrentPage(page);
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const pageProps = {
    user,
    onNavigate: handleNavigate,
    onLogout: handleLogout,
    onBack: () => handleNavigate("VirtualOffice"),
  };

  switch (currentPage) {
    case "Profile":
      return <Profile {...pageProps} />;
    case "People":
      return <People {...pageProps} />;
    case "MyTeam":
      return <MyTeam {...pageProps} />;
    case "Meetings":
      return <Meetings {...pageProps} />;
    case "Chat":
      return <Chat {...pageProps} />;
    case "Settings":
      return <Settings {...pageProps} />;
    default:
      return <VirtualOffice {...pageProps} />;
  }
}

export default App;