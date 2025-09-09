export function apiFetch(url: string, init: RequestInit) {
    return fetch(`http://localhost:8000${url}`, init)
}

export function getRandomEmail() {
    return `user_${crypto.randomUUID()}@example.com`
}