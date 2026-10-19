
import { useState } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // Temporary demo credentials.
    if (username.trim().toLowerCase() === "rajdip" && password === "123456") {
      onLogin({
        name: "Rajdip Jana",
        username: "rajdip",
      });
    } else {
      setError("Invalid username or password. Please try again.");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">P</div>
          <h1>ProxiSpeak</h1>
          <p>Your virtual office awaits.</p>
        </div>

        <div className="login-heading">
          <h2>Welcome back</h2>
          <p>Sign in to enter your workspace.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-button" type="submit">
            Enter Virtual Office <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="login-demo">
          <p>Demo account</p>
          <span>Username: rajdip</span>
          <span>Password: 123456</span>
        </div>

        <p className="login-footer">
          ProxiSpeak · Connect. Collaborate. Belong.
        </p>
      </section>
    </main>
  );
}

export default Login;
