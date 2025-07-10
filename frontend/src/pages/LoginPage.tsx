import "./AuthPages.css"

export default function LoginPage() {
    return (
        <form id="auth-form" method="post">
            <h1 id="title-h1">Log in</h1>
            <input id="email-input" type="email" name="email" placeholder="Email" />
            <input id="password-input" type="password" name="password" placeholder="Password" />
            <button id="submit-button">Login</button>
            <p>Don't have an account? <a id="recommendation-a" href="/signup">Sign up!</a></p>
        </form>
    )
}