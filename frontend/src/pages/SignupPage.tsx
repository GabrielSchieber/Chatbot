import "./AuthPages.css"

export default function SignupPage() {
    return (
        <form id="auth-form" method="post">
            <h1 id="title-h1">Sign up</h1>
            <input id="email-input" type="email" placeholder="Email" />
            <input id="password-input" type="password" placeholder="Password" />
            <button id="submit-button">Sign up</button>
            <p>Already have an account? <a id="recommendation-a" href="/login">Log in!</a></p>
        </form>
    )
}