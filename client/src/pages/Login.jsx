
import { useState } from "react";
import "./Login.css";

// Demo employee accounts
const employees = {
  rajdip: {
    name: "Rajdip Jana",
    username: "rajdip",
  },
  dona: {
    name: "Dona Mondal",
    username: "dona",
  },
  rithvik: {
    name: "Rithvik kolipaka",
    username: "rithvik",
  },

  abdul: {
    name: "Abdul Muhyee",
    username: "abdul",
  },
  
};

const COMMON_PASSWORD = "123456";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const loginId = username.trim().toLowerCase();
    const employee = employees[loginId];

    if (employee && password === COMMON_PASSWORD) {
      onLogin(employee);
    } else {
      setError("Invalid login ID or password. Please try again.");
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">P</div>
          <h1>ProxiSpeak</h1>
          <p>Your virtual workspace</p>
        </div>

        <div className="login-heading">
          <h2>Welcome back</h2>
          <p>Sign in to enter your virtual office.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Employee Login ID</label>
          <input
            id="username"
            type="text"
            placeholder="Enter your login ID"
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
            Sign In <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="login-demo">
          <p>Demo Login Credentials</p>
          <span>Rajdip: rajdip</span>
          <span>Dona: dona</span>
          <span>Rithvik: rithvik</span>
          <span>Abdul: abdul</span>
          <span>Password for all: 123456</span>
        </div>

        <p className="login-footer">
          ProxiSpeak · Virtual Office Demo
        </p>
      </div>
    </div>
  );
}

export default Login;
